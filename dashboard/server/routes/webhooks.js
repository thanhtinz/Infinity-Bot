'use strict';

/**
 * Public (unauthenticated) webhook endpoints for shop payment gateways. Mounted directly on the
 * dashboard's Express app (dashboard/server/app.js) OUTSIDE the `ensureAuthenticated` guild-session
 * gate, since PayOS/PayPal call these server-to-server with no Discord session of their own. Every
 * route here MUST independently verify the request is genuinely from the gateway before trusting
 * it (PayOS: HMAC signature; PayPal: we call back into PayPal itself to capture the order, so a
 * forged `token` simply fails at PayPal's end).
 */

const express = require('express');
const { ShopOrder } = require('../lib/models');
const { verifyWebhookSignature } = require('../../../src/bot/utils/payments/payosClient');
const { captureOrder } = require('../../../src/bot/utils/payments/paypalClient');
const { fulfillOrder } = require('../lib/botApi');

const router = express.Router();

function resultPage(title, message) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:4rem;background:#0f1115;color:#f4f4f5">
<h2>${title}</h2><p>${message}</p><p style="opacity:.6">You can close this tab and return to Discord.</p>
</body></html>`;
}

// PayOS calls this after a QR payment succeeds (or fails). Body shape per PayOS docs:
// { code, desc, success, data: { orderCode, amount, description, ... }, signature }
router.post('/payos', async (req, res) => {
    try {
        const body = req.body || {};
        const valid = await verifyWebhookSignature(body);
        if (!valid) return res.status(400).json({ error: 'invalid signature' });

        const orderCode = body.data?.orderCode;
        if (orderCode === undefined) return res.status(400).json({ error: 'missing orderCode' });

        const order = await ShopOrder.findOne({ where: { paymentMethod: 'payos', paymentReference: String(orderCode) } });
        if (!order) return res.status(404).json({ error: 'order not found' });

        const paid = body.success === true || body.code === '00';
        if (paid && order.status !== 'paid') {
            order.status = 'paid';
            await order.save();
            await fulfillOrder(order.id).catch((err) => console.error('[PayOS webhook] fulfill-order call failed:', err.message));
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('[PayOS webhook] unhandled error:', error.message);
        res.status(500).json({ error: 'internal error' });
    }
});

// Buyer lands here after approving payment on PayPal's site (return_url). PayPal Checkout Orders
// requires an explicit capture call after approval - this is that call.
router.get('/paypal-return', async (req, res) => {
    const token = req.query.token; // PayPal order id
    try {
        if (!token) throw new Error('missing token');

        const captured = await captureOrder(token);
        const order = await ShopOrder.findOne({ where: { paymentMethod: 'paypal', paymentReference: token } });

        if (order && captured.status === 'COMPLETED' && order.status !== 'paid') {
            order.status = 'paid';
            await order.save();
            await fulfillOrder(order.id).catch((err) => console.error('[PayPal return] fulfill-order call failed:', err.message));
        }

        if (captured.status === 'COMPLETED') {
            return res.send(resultPage('Payment successful', 'Your order will update in Discord shortly.'));
        }
        return res.send(resultPage('Payment not completed', `Status: ${captured.status}`));
    } catch (error) {
        res.status(400).send(resultPage('Payment could not be confirmed', error.message || 'Unknown error'));
    }
});

router.get('/paypal-cancel', (req, res) => {
    res.send(resultPage('Payment cancelled', 'No charge was made.'));
});

module.exports = router;
