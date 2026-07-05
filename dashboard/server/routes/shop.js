'use strict';

const express = require('express');
const { ShopCategory, ShopProduct, ShopCoupon, ShopOrder, ShopFlashSale } = require('../lib/models');
const { fulfillOrder } = require('../lib/botApi');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [categories, products, coupons, flashSales, orders] = await Promise.all([
        ShopCategory.findAll({ where: { guildId }, order: [['position', 'ASC']] }),
        ShopProduct.findAll({ where: { guildId }, order: [['name', 'ASC']] }),
        ShopCoupon.findAll({ where: { guildId }, order: [['createdAt', 'DESC']] }),
        ShopFlashSale.findAll({ where: { guildId }, order: [['createdAt', 'DESC']] }),
        ShopOrder.findAll({ where: { guildId }, order: [['createdAt', 'DESC']], limit: 200 })
    ]);
    res.json({ categories, products, coupons, flashSales, orders });
});

// ---- Categories ----------------------------------------------------------------------------

router.post('/categories', async (req, res) => {
    const { guildId } = req.params;
    const { name, description, position } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const category = await ShopCategory.create({ guildId, name, description: description || null, position: position || 0 });
    res.status(201).json(category);
});

router.put('/categories/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const category = await ShopCategory.findOne({ where: { id, guildId } });
    if (!category) return res.status(404).json({ error: 'category not found' });
    for (const field of ['name', 'description', 'position']) {
        if (req.body?.[field] !== undefined) category[field] = req.body[field];
    }
    await category.save();
    res.json(category);
});

router.delete('/categories/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await ShopCategory.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'category not found' });
    res.json({ ok: true });
});

// ---- Products -------------------------------------------------------------------------------

router.post('/products', async (req, res) => {
    const { guildId } = req.params;
    const { name, description, categoryId, priceVnd, priceUsd, roleId, stock, imageUrl, active } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const product = await ShopProduct.create({
        guildId, name, description: description || null,
        categoryId: categoryId || null,
        priceVnd: priceVnd ?? null, priceUsd: priceUsd ?? null,
        roleId: roleId || null, stock: stock ?? null, imageUrl: imageUrl || null,
        active: active !== false
    });
    res.status(201).json(product);
});

router.put('/products/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const product = await ShopProduct.findOne({ where: { id, guildId } });
    if (!product) return res.status(404).json({ error: 'product not found' });
    for (const field of ['name', 'description', 'categoryId', 'priceVnd', 'priceUsd', 'roleId', 'stock', 'imageUrl', 'active']) {
        if (req.body?.[field] !== undefined) product[field] = req.body[field];
    }
    await product.save();
    res.json(product);
});

router.delete('/products/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await ShopProduct.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'product not found' });
    res.json({ ok: true });
});

// ---- Coupons --------------------------------------------------------------------------------

router.post('/coupons', async (req, res) => {
    const { guildId } = req.params;
    const { code, discountType, discountValue, maxUses, expiresAt } = req.body || {};
    if (!code || !discountValue) return res.status(400).json({ error: 'code and discountValue are required' });

    const normalizedCode = String(code).trim().toUpperCase();
    const existing = await ShopCoupon.findOne({ where: { guildId, code: normalizedCode } });
    if (existing) return res.status(409).json({ error: 'a coupon with that code already exists' });

    const coupon = await ShopCoupon.create({
        guildId, code: normalizedCode,
        discountType: discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue, maxUses: maxUses ?? null, expiresAt: expiresAt || null, active: true
    });
    res.status(201).json(coupon);
});

router.put('/coupons/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const coupon = await ShopCoupon.findOne({ where: { id, guildId } });
    if (!coupon) return res.status(404).json({ error: 'coupon not found' });
    for (const field of ['discountType', 'discountValue', 'maxUses', 'expiresAt', 'active']) {
        if (req.body?.[field] !== undefined) coupon[field] = req.body[field];
    }
    if (req.body?.code !== undefined) coupon.code = String(req.body.code).trim().toUpperCase();
    await coupon.save();
    res.json(coupon);
});

router.delete('/coupons/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await ShopCoupon.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'coupon not found' });
    res.json({ ok: true });
});

// ---- Flash sales ----------------------------------------------------------------------------

router.post('/flashsales', async (req, res) => {
    const { guildId } = req.params;
    const { productId, discountPercent, startsAt, endsAt } = req.body || {};
    if (!productId || !discountPercent || !startsAt || !endsAt) {
        return res.status(400).json({ error: 'productId, discountPercent, startsAt and endsAt are required' });
    }
    const product = await ShopProduct.findOne({ where: { id: productId, guildId } });
    if (!product) return res.status(404).json({ error: 'product not found' });

    const sale = await ShopFlashSale.create({ guildId, productId, discountPercent, startsAt, endsAt, active: true });
    res.status(201).json(sale);
});

router.put('/flashsales/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const sale = await ShopFlashSale.findOne({ where: { id, guildId } });
    if (!sale) return res.status(404).json({ error: 'flash sale not found' });
    for (const field of ['discountPercent', 'startsAt', 'endsAt', 'active']) {
        if (req.body?.[field] !== undefined) sale[field] = req.body[field];
    }
    await sale.save();
    res.json(sale);
});

router.delete('/flashsales/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await ShopFlashSale.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'flash sale not found' });
    res.json({ ok: true });
});

// ---- Orders (read-only list + manual confirmation for crypto payments) ----------------------

router.get('/orders', async (req, res) => {
    const { guildId } = req.params;
    const where = { guildId };
    if (req.query.status) where.status = req.query.status;
    const orders = await ShopOrder.findAll({ where, order: [['createdAt', 'DESC']], limit: 500 });
    res.json(orders);
});

// Crypto payments have no automated webhook (see README "Shop / Premium") - an admin confirms them
// here once they've verified the on-chain transfer manually.
router.post('/orders/:id/mark-paid', async (req, res) => {
    const { guildId, id } = req.params;
    const order = await ShopOrder.findOne({ where: { id, guildId } });
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (order.status === 'paid') return res.json({ ok: true, alreadyPaid: true });

    order.status = 'paid';
    await order.save();

    try {
        await fulfillOrder(order.id);
    } catch (error) {
        // The order is already marked paid in our DB - surface the fulfillment error so the admin
        // knows the role grant may need to be done by hand, but don't roll back the paid status.
        return res.json({ ok: true, fulfillmentWarning: error.message || 'failed to notify the bot' });
    }

    res.json({ ok: true });
});

router.post('/orders/:id/cancel', async (req, res) => {
    const { guildId, id } = req.params;
    const order = await ShopOrder.findOne({ where: { id, guildId } });
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (!['pending', 'failed'].includes(order.status)) return res.status(400).json({ error: 'only pending or failed orders can be cancelled' });
    order.status = 'cancelled';
    await order.save();
    res.json(order);
});

module.exports = router;
