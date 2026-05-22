"""
embed_utils.py — Load embed templates from DB and build discord.Embed with variable substitution.

Used across all bot cogs:
    from src.bot.embed_utils import build_embed, DEFAULTS

    embed = build_embed("don_hang_moi", db_session, vars={...})
"""
import datetime
import discord
from sqlalchemy import select
from sqlalchemy.orm import Session


# ── Default templates (used when no customisation exists in DB) ──────────

DEFAULTS: dict[str, dict] = {
    "don_hang_moi": {
        "title": "🛒 New Order",
        "description": "Please pay to complete your order.\n⏰ Expires after **15 minutes**.",
        "color": "#F0B232",
        "footer": "⏳ Awaiting payment...",
        "fields": [
            {"name": "🔢 Order ID", "value": "#{order.id}", "inline": True},
            {"name": "👤 Customer", "value": "{user.mention}", "inline": True},
            {"name": "📦 Product", "value": "{product.name}", "inline": False},
            {"name": "💰 Amount", "value": "{order.total} VNĐ", "inline": True},
        ],
    },
    "thanh_toan": {
        "title": "✅ Payment Successful",
        "description": "Thank you {user.mention}! Order #{order.id} has been paid.",
        "color": "#57F287",
        "footer": "Infinity Mall",
        "fields": [
            {"name": "📦 Product", "value": "{product.name}", "inline": True},
            {"name": "💰 Amount", "value": "{order.total} VNĐ", "inline": True},
        ],
    },
    "giao_hang": {
        "title": "📦 Order Delivered",
        "description": "Your order #{order.id} has been delivered successfully!",
        "color": "#5865F2",
        "footer": "Infinity Mall — Thank you for your purchase!",
        "fields": [
            {"name": "📦 Product", "value": "{product.name}", "inline": True},
            {"name": "📅 Delivery Date", "value": "{date}", "inline": True},
        ],
    },
    "feedback": {
        "title": "⭐ New Feedback",
        "description": "**{user}** left a review for **{product.name}**",
        "color": "#FEE75C",
        "footer": "Infinity Mall — Feedback system",
        "fields": [
            {"name": "Rating", "value": "{stars}", "inline": True},
            {"name": "Content", "value": "{content}", "inline": False},
        ],
    },
    "giveaway": {
        "title": "🎉 GIVEAWAY",
        "description": "{prize}\n\nPress the button below to enter!\n⏰ Ends: {ends_at}",
        "color": "#EB459E",
        "footer": "Host: {host} • Winners: {winners_count}",
        "fields": [],
    },
    "don_hang_het_han": {
        "title": "⏰ Order Expired",
        "description": "Your order #{order.id} has expired due to non-payment after 15 minutes.",
        "color": "#ED4245",
        "footer": "Create a new order to continue shopping.",
        "fields": [
            {"name": "📦 Product", "value": "{product.name}", "inline": True},
        ],
    },
    "ghi_chu_don_hang": {
        "title": "📝 Order Note",
        "description": "Order #{order.id} by {user.mention} has been updated with a note.",
        "color": "#5865F2",
        "footer": "Infinity Mall",
        "fields": [
            {"name": "📦 Product", "value": "{product.name}", "inline": True},
            {"name": "📝 Note", "value": "{note}", "inline": False},
        ],
    },
    "ket_qua_giveaway": {
        "title": "🏆 Giveaway Results",
        "description": "The giveaway has ended!\nPrize: **{prize}**",
        "color": "#EB459E",
        "footer": "Congratulations to the winner!",
        "fields": [
            {"name": "🎉 Winner", "value": "{winners}", "inline": False},
        ],
    },
    "canh_bao": {
        "title": "⚠️ Warning",
        "description": "{user.mention} has received a warning from the moderation team.",
        "color": "#FEE75C",
        "footer": "Please follow the server rules",
        "fields": [
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
            {"name": "🔢 Total Warnings", "value": "{warn_count}", "inline": True},
        ],
    },
    # ── Moderation ────────────────────────────────────────────────────────────
    "kick": {
        "title": "👟 Kicked",
        "description": "{user.mention} has been kicked from **{server}**.",
        "color": "#ED4245",
        "footer": "Action performed by the moderation team",
        "fields": [
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "ban": {
        "title": "🔨 Banned",
        "description": "{user.mention} has been permanently banned from **{server}**.",
        "color": "#ED4245",
        "footer": "Appeal if you believe this was a mistake",
        "fields": [
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "timeout": {
        "title": "⏱️ Timed Out",
        "description": "{user.mention} has been timed out in **{server}**.",
        "color": "#FEE75C",
        "footer": "Please follow the server rules",
        "fields": [
            {"name": "⏰ Duration", "value": "{duration}", "inline": True},
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
        ],
    },
    # ── Invite / Community ────────────────────────────────────────────────────
    "invite_join": {
        "title": "🎉 New Member via Invite",
        "description": "{user.mention} joined via **{inviter.name}**'s invite link!",
        "color": "#57F287",
        "footer": "Infinity Mall — Invite Tracking",
        "fields": [
            {"name": "🔗 Invite Code", "value": "{invite.code}", "inline": True},
            {"name": "📊 {inviter.name}'s Total Invites", "value": "{inviter.total_invites}", "inline": True},
        ],
    },
    # Alias for dashboard compatibility
    "invite_leaderboard": {
        "title": "🏆 Invite Leaderboard",
        "description": "Top members with the most invites in **{server}**.",
        "color": "#F0B232",
        "footer": "Updated: {updated_at}",
        "fields": [],
    },
    # ── Spending / Order Leaderboard ─────────────────────────────────────────
    "bxh_chi_tieu": {
        "title": "🏆 Spending Leaderboard — {time_label}",
        "description": "{leaderboard_lines}",
        "color": "#F0B232",
        "footer": "Updated: {updated_at}",
        "fields": [],
    },
    "bxh_don_hang": {
        "title": "🏆 Order Leaderboard — {time_label}",
        "description": "{leaderboard_lines}",
        "color": "#F0B232",
        "footer": "Updated: {updated_at}",
        "fields": [],
    },
    "milestone_reached": {
        "title": "🏆 Milestone Reached!",
        "description": "Congratulations {user.mention}!\nYou've reached the **{milestone.name}** milestone with a total spend of **{milestone.threshold}**.\nYou've been granted the role {role.mention}!",
        "color": "#F0B232",
        "footer": "Total spent: {user.total}",
        "fields": [],
    },
    # ── QR / Payment ──────────────────────────────────────────────────────────
    "qr_thanh_toan": {
        "title": "💳 Payment for Order #{order.id}",
        "description": "Scan the QR code below to pay.\nOrder expires after **15 minutes**.",
        "color": "#5865F2",
        "footer": "Scan QR with your banking app",
        "image_url": "{qr_url}",
        "fields": [
            {"name": "💰 Amount", "value": "{order.total} VNĐ", "inline": True},
            {"name": "📝 Transfer Content", "value": "{transfer_content}", "inline": True},
        ],
    },
    # ── Per-payment embed events ──────────────────────────────────────────────
    "qr_thanh_toan_payos": {
        "title": "💳 Payment — PayOS",
        "description": "Order **#{order.id}**\nAmount: **{order.total}**\n\n[Click to pay]({qr_url})",
        "color": "#5865F2",
        "fields": [
            {"name": "Transfer Content", "value": "{transfer_content}", "inline": True},
            {"name": "Expires", "value": "15 minutes", "inline": True},
        ],
    },
    "qr_thanh_toan_paypal": {
        "title": "💳 Payment — PayPal",
        "description": "Order **#{order.id}**\nAmount: **{order.total}**\n\n[Pay with PayPal]({qr_url})",
        "color": "#0070BA",
        "fields": [],
    },
    "qr_thanh_toan_crypto": {
        "title": "💳 Payment — Crypto",
        "description": "Order **#{order.id}**\nAmount: **{order.total}**\n\n[Pay with Crypto]({qr_url})",
        "color": "#F7931A",
        "fields": [],
    },
    "qr_thanh_toan_manual": {
        "title": "💳 Manual Payment",
        "description": "Order **#{order.id}**\nAmount: **{order.total}**\n\n**Bank:** {bank_name}\n**Account:** {account_holder}\n**Number:** {account_number}\n**Transfer content:** {transfer_content}\n\n{instructions}",
        "color": "#10B981",
        "fields": [],
    },
    # ── Order details ─────────────────────────────────────────────────────────
    "don_hang_chi_tiet": {
        "title": "📋 Order Details #{order.id}",
        "description": "Order information.",
        "color": "#5865F2",
        "fields": [
            {"name": "👤 Customer", "value": "{user.mention}", "inline": True},
            {"name": "📊 Status", "value": "{order.status}", "inline": True},
            {"name": "📦 Product", "value": "{product.name}", "inline": False},
            {"name": "💰 Amount", "value": "{order.total} VNĐ", "inline": True},
            {"name": "📅 Created", "value": "{order.created_at}", "inline": True},
        ],
    },
    # ── Product ───────────────────────────────────────────────────────────────
    # ── Coupon ────────────────────────────────────────────────────────────────
    "coupon": {
        "title": "🏷️ Coupon Applied",
        "description": "Coupon **{coupon.code}** has been applied!",
        "color": "#FEE75C",
        "fields": [
            {"name": "💸 Discount", "value": "{coupon.discount}", "inline": True},
            {"name": "⏰ Expires", "value": "{coupon.expires_at}", "inline": True},
        ],
    },
    # ── Shop ban/unban ────────────────────────────────────────────────────────
    "ban_shop": {
        "title": "🚫 Shop Banned",
        "description": "{user.mention} has been banned from purchasing.",
        "color": "#ED4245",
        "fields": [
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
            {"name": "👮 Action By", "value": "{moderator}", "inline": True},
        ],
    },
    "unban_shop": {
        "title": "✅ Shop Unbanned",
        "description": "{user.mention} has been unbanned from purchasing.",
        "color": "#57F287",
        "fields": [
            {"name": "👮 Action By", "value": "{moderator}", "inline": True},
        ],
    },
    # ── Flash Sale ────────────────────────────────────────────────────────────
    "flash_sale_start": {
        "title": "⚡ Flash Sale Started!",
        "description": "**{product.name}** — Package **{package.name}** is on sale!\n🔥 Discount: **{sale.discount}**",
        "color": "#FF6B35",
        "fields": [
            {"name": "⏰ Ends At", "value": "{sale.ends_at}", "inline": True},
            {"name": "📦 Quantity", "value": "{sale.qty_limit}", "inline": True},
            {"name": "🎫 Coupons", "value": "{sale.allow_coupon}", "inline": True},
        ],
    },
    "flash_sale_end": {
        "title": "🏁 Flash Sale Ended",
        "description": "Flash sale for **{product.name}** — **{package.name}** has ended.",
        "color": "#99AAB5",
        "fields": [
            {"name": "🛒 Sold", "value": "{sale.qty_used} / {sale.qty_limit}", "inline": True},
        ],
    },
    "out_of_stock_admin": {
        "title": "⚠️ Out of Stock — Manual Delivery Required",
        "description": "Order **#{order.id}** by {user.mention} for **{product.name}** requires manual delivery (inventory empty).",
        "color": "#FEE75C",
        "fields": [
            {"name": "📦 Package", "value": "{product.name}", "inline": True},
            {"name": "🆔 Order", "value": "#{order.id}", "inline": True},
        ],
    },
    "spending_leaderboard_auto": {
        "title": "🏆 Spending Leaderboard — {period}",
        "description": "{leaderboard}",
        "color": "#F0B232",
        "fields": [
            {"name": "📅 Date", "value": "{date}", "inline": True},
        ],
    },
    # ── Giveaway banned ───────────────────────────────────────────────────────
    "giveaway_banned": {
        "title": "⛔ Giveaway Banned",
        "description": "{user.mention} has been banned from giveaways.",
        "color": "#ED4245",
        "fields": [
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
        ],
    },
    # ── Unban ─────────────────────────────────────────────────────────────────
    "unban": {
        "title": "🔓 Member Unbanned",
        "description": "{user.mention} has been unbanned from **{server}**.",
        "color": "#57F287",
        "fields": [
            {"name": "👮 Action By", "value": "{moderator}", "inline": True},
        ],
    },
    # ── Sticky ────────────────────────────────────────────────────────────────
    "sticky_message": {
        "title": "{sticky.title}",
        "description": "{sticky.content}",
        "color": "#5865F2",
        "footer": "Sticky Message",
        "fields": [],
    },
    # ── Phase 4: Logging ──────────────────────────────────────────────────────
    "log_message_delete": {
        "title": "🗑️ Message Deleted",
        "description": "Message by {user.mention} in {channel} was deleted.",
        "color": "#ED4245",
        "fields": [
            {"name": "Content", "value": "{content}", "inline": False},
        ],
    },
    "log_message_edit": {
        "title": "✏️ Message Edited",
        "description": "{user.mention} edited a message in {channel}. [Jump]({message.url})",
        "color": "#FEE75C",
        "fields": [
            {"name": "Before", "value": "{before}", "inline": False},
            {"name": "After", "value": "{after}", "inline": False},
        ],
    },
    "log_message_bulk_delete": {
        "title": "🗑️ Bulk Delete",
        "description": "**{count}** messages were deleted in {channel}.",
        "color": "#ED4245",
        "fields": [],
    },
    "log_voice_join": {
        "title": "🔊 Joined Voice",
        "description": "{user.mention} joined {channel}.",
        "color": "#57F287",
        "fields": [],
    },
    "log_voice_leave": {
        "title": "🔇 Left Voice",
        "description": "{user.mention} left {channel}.",
        "color": "#ED4245",
        "fields": [],
    },
    "log_voice_move": {
        "title": "🔀 Moved Voice",
        "description": "{user.mention} moved from {from} to {to}.",
        "color": "#FEE75C",
        "fields": [],
    },
    "log_member_join": {
        "title": "📥 Member Joined",
        "description": "{user.mention} has joined the server.",
        "color": "#57F287",
        "fields": [
            {"name": "Account Created", "value": "{account_age}", "inline": True},
            {"name": "Member #", "value": "{member_count}", "inline": True},
        ],
    },
    "log_member_leave": {
        "title": "📤 Member Left",
        "description": "{user.mention} has left the server.",
        "color": "#ED4245",
        "fields": [
            {"name": "Roles", "value": "{roles}", "inline": False},
            {"name": "Remaining", "value": "{member_count} members", "inline": True},
        ],
    },
    "log_nickname_change": {
        "title": "📝 Nickname Changed",
        "description": "{user.mention} changed their nickname.",
        "color": "#5865F2",
        "fields": [
            {"name": "Before", "value": "{before}", "inline": True},
            {"name": "After", "value": "{after}", "inline": True},
        ],
    },
    "log_role_update": {
        "title": "🎭 Role Updated",
        "description": "Roles for {user.mention} have been updated.",
        "color": "#5865F2",
        "fields": [
            {"name": "Changes", "value": "{changes}", "inline": False},
        ],
    },
    "log_channel_create": {
        "title": "📺 Channel Created",
        "description": "Channel {channel} ({type}) was created.",
        "color": "#57F287",
        "fields": [],
    },
    "log_channel_delete": {
        "title": "📺 Channel Deleted",
        "description": "Channel **{channel.name}** ({type}) was deleted.",
        "color": "#ED4245",
        "fields": [],
    },

    # ── Auto Mod ──────────────────────────────────────────────────────────
    "automod_warn": {
        "title": "⚠️ AutoMod — Warning",
        "description": "{user.mention} was warned by AutoMod.\n**Reason:** {reason}",
        "color": "#FEE75C",
        "fields": [{"name": "Channel", "value": "{channel}", "inline": True}],
    },
    "automod_mute": {
        "title": "🔇 AutoMod — Mute",
        "description": "{user.mention} was muted by AutoMod.\n**Reason:** {reason}",
        "color": "#E67E22",
        "fields": [{"name": "Duration", "value": "{duration}", "inline": True}],
    },
    "automod_kick": {
        "title": "👢 AutoMod — Kick",
        "description": "{user.mention} was kicked by AutoMod.\n**Reason:** {reason}",
        "color": "#ED4245",
        "fields": [],
    },
    "automod_delete": {
        "title": "🗑️ AutoMod — Message Deleted",
        "description": "Message by {user.mention} was deleted by AutoMod.\n**Reason:** {reason}",
        "color": "#95A5A6",
        "fields": [{"name": "Content", "value": "{content}", "inline": False}],
    },

    # ── Reaction Roles ────────────────────────────────────────────────────
    "reaction_role_panel": {
        "title": "🎭 Select Role",
        "description": "React with the corresponding emoji to get a role!",
        "color": "#5865F2",
        "fields": [],
    },

    # ── Starboard ─────────────────────────────────────────────────────────
    "starboard_post": {
        "title": "",
        "description": "{content}",
        "color": "#F1C40F",
        "fields": [{"name": "Source", "value": "[Jump to message]({message.url})", "inline": True}],
    },

    # ── AFK ────────────────────────────────────────────────────────────────
    "afk_set": {
        "title": "💤 AFK",
        "description": "{user.mention} is now AFK: **{reason}**",
        "color": "#95A5A6",
        "fields": [],
    },
    "afk_return": {
        "title": "👋 Welcome Back",
        "description": "{user.mention} is back! (AFK {duration})",
        "color": "#57F287",
        "fields": [],
    },

    # ── Interactions — targeted ───────────────────────────────────────────
    "interact_airkiss":    {"title": "😘 Airkiss!", "description": "{user.mention} sends an air kiss to {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_angrystare": {"title": "😠 Angry Stare!", "description": "{user.mention} glares angrily at {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_bite":       {"title": "😬 Bite!", "description": "{user.mention} bites {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_brofist":    {"title": "🤜 Brofist!", "description": "{user.mention} brofists {target.mention}", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_cuddle":     {"title": "🤗 Cuddle!", "description": "{user.mention} cuddles {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_handhold":   {"title": "🤝 Handhold!", "description": "{user.mention} holds hands with {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_hug":        {"title": "🫂 Hug!", "description": "{user.mention} hugs {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_kiss":       {"title": "💋 Kiss!", "description": "{user.mention} kisses {target.mention}", "color": "#E91E63", "image_url": "{gif_url}", "fields": []},
    "interact_lick":       {"title": "👅 Lick!", "description": "{user.mention} licks {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_nom":        {"title": "😋 Nom!", "description": "{user.mention} noms {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_nuzzle":     {"title": "🥰 Nuzzle!", "description": "{user.mention} nuzzles {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_pat":        {"title": "🤚 Pat!", "description": "{user.mention} pats {target.mention}'s head", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_pinch":      {"title": "🤏 Pinch!", "description": "{user.mention} pinches {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_poke":       {"title": "👉 Poke!", "description": "{user.mention} pokes {target.mention}", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_punch":      {"title": "👊 Punch!", "description": "{user.mention} punches {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_slap":       {"title": "🫲 Slap!", "description": "{user.mention} slaps {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_smack":      {"title": "💥 Smack!", "description": "{user.mention} smacks {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_tickle":     {"title": "🤭 Tickle!", "description": "{user.mention} tickles {target.mention}", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_wave":       {"title": "👋 Wave!", "description": "{user.mention} waves at {target.mention}", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_wink":       {"title": "😉 Wink!", "description": "{user.mention} winks at {target.mention}", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_stare":      {"title": "👀 Stare!", "description": "{user.mention} stares at {target.mention}", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_peek":       {"title": "🫣 Peek!", "description": "{user.mention} peeks at {target.mention}", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},

    # ── Interactions — self / expressions ──────────────────────────────────
    "interact_bleh":       {"title": "😝 Bleh!", "description": "{user.mention} sticks their tongue out", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_blush":      {"title": "😊 Blush!", "description": "{user.mention} blushes", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_celebrate":  {"title": "🎉 Celebrate!", "description": "{user.mention} celebrates", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_cheers":     {"title": "🍻 Cheers!", "description": "{user.mention} raises a glass", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_clap":       {"title": "👏 Clap!", "description": "{user.mention} claps", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_confused":   {"title": "😕 Confused!", "description": "{user.mention} is confused", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_cool":       {"title": "😎 Cool!", "description": "{user.mention} looks cool", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_cry":        {"title": "😢 Cry!", "description": "{user.mention} cries", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_dance":      {"title": "💃 Dance!", "description": "{user.mention} dances", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_drool":      {"title": "🤤 Drool!", "description": "{user.mention} drools", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_evillaugh":  {"title": "😈 Evil Laugh!", "description": "{user.mention} laughs evilly", "color": "#8E44AD", "image_url": "{gif_url}", "fields": []},
    "interact_facepalm":   {"title": "🤦 Facepalm!", "description": "{user.mention} facepalms", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_happy":      {"title": "😄 Happy!", "description": "{user.mention} is happy", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_headbang":   {"title": "🤘 Headbang!", "description": "{user.mention} headbangs", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_huh":        {"title": "❓ Huh?", "description": "{user.mention} is confused", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_laugh":      {"title": "😂 Laugh!", "description": "{user.mention} laughs", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_love":       {"title": "❤️ Love!", "description": "{user.mention} is in love", "color": "#E91E63", "image_url": "{gif_url}", "fields": []},
    "interact_mad":        {"title": "😡 Mad!", "description": "{user.mention} is angry", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_nervous":    {"title": "😰 Nervous!", "description": "{user.mention} is nervous", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_no":         {"title": "🙅 No!", "description": "{user.mention} shakes their head", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_nosebleed":  {"title": "🫠 Nosebleed!", "description": "{user.mention} gets a nosebleed", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_nyah":       {"title": "😜 Nyah~", "description": "{user.mention} nyah~", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_pout":       {"title": "😤 Pout!", "description": "{user.mention} pouts", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_roll":       {"title": "🙄 Roll!", "description": "{user.mention} rolls their eyes", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_run":        {"title": "🏃 Run!", "description": "{user.mention} runs", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_sad":        {"title": "😞 Sad!", "description": "{user.mention} is sad", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_scared":     {"title": "😱 Scared!", "description": "{user.mention} is scared", "color": "#8E44AD", "image_url": "{gif_url}", "fields": []},
    "interact_shout":      {"title": "📢 Shout!", "description": "{user.mention} shouts", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_shrug":      {"title": "🤷 Shrug!", "description": "{user.mention} shrugs", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_shy":        {"title": "🙈 Shy!", "description": "{user.mention} is shy", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_sigh":       {"title": "😮‍💨 Sigh!", "description": "{user.mention} sighs", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_sip":        {"title": "🍵 Sip!", "description": "{user.mention} takes a sip", "color": "#2ECC71", "image_url": "{gif_url}", "fields": []},
    "interact_sleep":      {"title": "😴 Sleep!", "description": "{user.mention} falls asleep", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_slowclap":   {"title": "👏 Slow Clap!", "description": "{user.mention} slow claps", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_smile":      {"title": "😊 Smile!", "description": "{user.mention} smiles", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_smug":       {"title": "😏 Smug!", "description": "{user.mention} looks smug", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_sneeze":     {"title": "🤧 Sneeze!", "description": "{user.mention} sneezes", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_sorry":      {"title": "🙏 Sorry!", "description": "{user.mention} apologizes", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_stop":       {"title": "🛑 Stop!", "description": "{user.mention} says stop", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_surprised":  {"title": "😲 Surprised!", "description": "{user.mention} is surprised", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_sweat":      {"title": "😓 Sweat!", "description": "{user.mention} sweats", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_thumbsup":   {"title": "👍 Thumbs Up!", "description": "{user.mention} gives a thumbs up", "color": "#2ECC71", "image_url": "{gif_url}", "fields": []},
    "interact_tired":      {"title": "😩 Tired!", "description": "{user.mention} is tired", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_woah":       {"title": "😮 Woah!", "description": "{user.mention} says woah", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_yawn":       {"title": "🥱 Yawn!", "description": "{user.mention} yawns", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_yay":        {"title": "🥳 Yay!", "description": "{user.mention} says yay!", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_yes":        {"title": "✅ Yes!", "description": "{user.mention} nods", "color": "#2ECC71", "image_url": "{gif_url}", "fields": []},
    # ── Help ──
    "help_menu": {
        "title": "📋 Help — {bot_name}",
        "description": "Hello {user.mention}!\nSelect a **category** below to see the command list.",
        "color": "#5865F2",
        "footer": "{bot_name} • Select a category to continue",
        "fields": [],
    },
    "help_category": {
        "title": "{category_emoji} {category_name}",
        "description": "Commands in **{category_name}**:\n{commands_list}",
        "color": "#5865F2",
        "footer": "{bot_name} • Select a command for details",
        "fields": [],
    },
    "help_command": {
        "title": "/{command_name}",
        "description": "{command_desc}",
        "color": "#57F287",
        "footer": "{bot_name}",
        "fields": [
            {"name": "📌 Usage", "value": "{command_usage}", "inline": False},
        ],
    },
    "bang_gia": {
        "title": "🛒 Product Price List",
        "description": "Select a product from the menu below to view details and pricing.",
        "color": "#5865F2",
        "footer": "Click a product name below for details",
        "fields": [],
    },
    # ── Extended Moderation ───────────────────────────────────────────────────
    "softban": {
        "title": "🔨 Softbanned",
        "description": "{user.mention} has been softbanned from **{server}**.",
        "color": "#ED4245",
        "footer": "Softban — messages deleted",
        "fields": [
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "mute": {
        "title": "🔇 Muted",
        "description": "{user.mention} has been muted in **{server}**.",
        "color": "#5865F2",
        "footer": "Please follow the server rules",
        "fields": [
            {"name": "⏰ Duration", "value": "{duration}", "inline": True},
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
        ],
    },
    "deafen": {
        "title": "🔇 Deafened",
        "description": "{user.mention} has been deafened in **{server}**.",
        "color": "#9B59B6",
        "fields": [
            {"name": "📋 Reason", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "rolepersist": {
        "title": "📌 Role Persist",
        "description": "Role **{role.name}** has been persistently assigned to {user.mention}.",
        "color": "#5865F2",
        "fields": [
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "temprole": {
        "title": "⏱️ Temporary Role",
        "description": "Role **{role.name}** has been assigned to {user.mention} for **{duration}**.",
        "color": "#F0B232",
        "fields": [
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
            {"name": "⏰ Expires", "value": "{expires_at}", "inline": True},
        ],
    },
    "lockdown_start": {
        "title": "🔒 Lockdown",
        "description": "**{server}** has entered lockdown mode.",
        "color": "#ED4245",
        "fields": [
            {"name": "🔒 Channels Locked", "value": "{count}", "inline": True},
        ],
    },
    "lockdown_end": {
        "title": "🔓 Lockdown End",
        "description": "**{server}** has exited lockdown mode.",
        "color": "#57F287",
        "fields": [
            {"name": "🔓 Channels Unlocked", "value": "{count}", "inline": True},
        ],
    },
    # ── Backup & Restore ───────────────────────────────────────────────────
    "backup_completed": {
        "title": "✅ Backup Completed",
        "description": "Server backup completed successfully.",
        "color": "#57F287",
        "fields": [
            {"name": "📋 Type", "value": "{backup_type}", "inline": True},
            {"name": "📁 Channels", "value": "{channel_count}", "inline": True},
            {"name": "🎭 Roles", "value": "{role_count}", "inline": True},
            {"name": "👥 Members", "value": "{member_count}", "inline": True},
        ],
    },
    "restore_started": {
        "title": "🔄 Restoring...",
        "description": "Restoring server from backup.",
        "color": "#FEE75C",
        "fields": [],
    },
    "restore_completed": {
        "title": "✅ Restore Completed",
        "description": "Server has been restored successfully.",
        "color": "#57F287",
        "fields": [],
    },
    # ── Server Alerts ──
    "alert_mass_ban": {
        "title": "🚨 Mass Ban Detected",
        "description": "Multiple bans detected in a short period.",
        "color": "#ED4245",
        "fields": [
            {"name": "Actor", "value": "{actor}", "inline": True},
            {"name": "Events", "value": "{event_count} in {window_minutes}m", "inline": True},
            {"name": "Severity", "value": "{severity}", "inline": True},
        ],
    },
    "alert_mass_kick": {
        "title": "🚨 Mass Kick Detected",
        "description": "Multiple kicks detected in a short period.",
        "color": "#ED4245",
        "fields": [
            {"name": "Actor", "value": "{actor}", "inline": True},
            {"name": "Events", "value": "{event_count} in {window_minutes}m", "inline": True},
            {"name": "Severity", "value": "{severity}", "inline": True},
        ],
    },
    "alert_channel_delete": {
        "title": "⚠️ Channel Deletion Storm",
        "description": "Multiple channels deleted in a short period.",
        "color": "#FEE75C",
        "fields": [
            {"name": "Actor", "value": "{actor}", "inline": True},
            {"name": "Events", "value": "{event_count} in {window_minutes}m", "inline": True},
        ],
    },
    "alert_role_delete": {
        "title": "⚠️ Role Deletion Storm",
        "description": "Multiple roles deleted in a short period.",
        "color": "#FEE75C",
        "fields": [
            {"name": "Actor", "value": "{actor}", "inline": True},
            {"name": "Events", "value": "{event_count} in {window_minutes}m", "inline": True},
        ],
    },
    "alert_nuke_detect": {
        "title": "🔴 NUKE ATTEMPT DETECTED",
        "description": "Destructive actions detected from a single actor. Immediate attention required!",
        "color": "#ED4245",
        "fields": [
            {"name": "Suspected Actor", "value": "{actor}", "inline": True},
            {"name": "Actions", "value": "{event_count} in {window_minutes}m", "inline": True},
            {"name": "Severity", "value": "CRITICAL", "inline": True},
        ],
    },
    # ── AI Chat ──────────────────────────────────────────────────────────────
    "ai_response": {
        "title": "🤖 AI Response",
        "description": "{ai.response}",
        "color": "#5865F2",
        "fields": [
            {"name": "Question", "value": "{ai.prompt}", "inline": False},
            {"name": "Model", "value": "{ai.model}", "inline": True},
        ],
        "footer": "Powered by {ai.provider}",
    },
    "ai_image": {
        "title": "Image Generated",
        "description": "**Prompt:** {ai.prompt}",
        "color": "#5865F2",
        "footer": "Generated by {ai.provider} - {user.name}",
    },
    # ── Auto Role ────────────────────────────────────────────────────
    "autorole_assign": {
        "title": "Auto Role Assigned",
        "description": "{user.mention} received role **{role.name}**",
        "color": "#43B581",
    },
    # ── Forms ────────────────────────────────────────────────────────
    "form_submitted": {
        "title": "New Application: {form.title}",
        "description": "Submitted by {user.mention}",
        "color": "#5865F2",
        "footer": "Form #{form.id} - Review pending",
    },
    "form_approved": {
        "title": "Application Approved",
        "description": "{user.mention}'s application for **{form.title}** has been approved.",
        "color": "#43B581",
    },
    "form_rejected": {
        "title": "Application Rejected",
        "description": "{user.mention}'s application for **{form.title}** has been rejected.",
        "color": "#F04747",
    },
    # ── Reminders ────────────────────────────────────────────────────
    "reminder_fire": {
        "title": "Reminder",
        "description": "{user.mention} — {reminder.message}",
        "color": "#FAA61A",
    },
    # ── Polls ────────────────────────────────────────────────────────
    "poll_created": {
        "title": "Poll: {poll.question}",
        "description": "{poll.options}",
        "color": "#5865F2",
        "footer": "Vote using buttons below - Ends {poll.end_time}",
    },
    "poll_ended": {
        "title": "Poll Ended: {poll.question}",
        "description": "{poll.results}",
        "color": "#747F8D",
        "footer": "Final results - {poll.total_votes} votes",
    },
    # ── Social Feeds ─────────────────────────────────────────────────
    "social_feed_post": {
        "title": "{feed.title}",
        "description": "{feed.url}",
        "color": "#FF0000",
        "footer": "{feed.platform} - {feed.author}",
    },
    # ── AFK ──────────────────────────────────────────────────────────
    "afk_set": {
        "title": "AFK",
        "description": "{user.mention} is now AFK: **{afk.reason}**",
        "color": "#747F8D",
    },
    "afk_return": {
        "title": "Welcome Back",
        "description": "{user.mention} is no longer AFK. Gone for **{afk.duration}**",
        "color": "#43B581",
    },
    "afk_mention": {
        "title": "User is AFK",
        "description": "{afk.user} is AFK: **{afk.reason}** (since {afk.since})",
        "color": "#747F8D",
    },
}


def _sub(text: str | None, vars: dict) -> str:
    """Replace {key} variables in a string."""
    if not text:
        return ""
    for k, v in vars.items():
        text = text.replace(f"{{{k}}}", str(v))
    return text


def _hex_to_int(hex_color: str) -> int:
    """Convert #RRGGBB to int for discord.Color."""
    try:
        return int(hex_color.lstrip("#"), 16)
    except Exception:
        return 0x5865F2


def resolve_image_url(image_url: str | None, db: Session) -> str | None:
    """
    Convert relative path (/static/uploads/...) to full URL usable in Discord.
    Returns None if missing or invalid.
    """
    if not image_url:
        return None
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return image_url
    if image_url.startswith("/"):
        # Relative path — need to prepend public_app_url
        from src.models.models import SystemConfig
        config = db.execute(select(SystemConfig).limit(1)).scalars().first()
        base = (config.public_app_url or "").rstrip("/") if config else ""
        if base:
            return base + image_url
    return None


def build_embed(
    event_type: str,
    db: Session,
    vars: dict | None = None,
    guild_id: str | int | None = None,
) -> discord.Embed:
    """
    Load template from DB (or use default), apply variable substitution, return discord.Embed.
    Always returns an Embed — if you need text mode, use build_response() instead.
    """
    result = build_response(event_type, db, vars, guild_id=guild_id)
    if isinstance(result, discord.Embed):
        return result
    # Fallback: wrap text in a minimal embed
    return discord.Embed(description=result, color=0x5865F2, timestamp=datetime.datetime.utcnow())


def build_response(
    event_type: str,
    db: Session,
    vars: dict | None = None,
    guild_id: str | int | None = None,
) -> discord.Embed | str:
    """
    Load template from DB (or use default), apply variable substitution.
    Returns discord.Embed if response_mode == "embed", or str if "text".

    guild_id: scope template lookup to a specific guild.
    vars can contain any key. Standard variables:
        user, user.id, user.mention, order.id, order.total,
        product.name, package, date, server, member_count,
        stars, content, prize, ends_at, host, winners_count
    """
    from src.models.models import EmbedTemplate

    if vars is None:
        vars = {}

    # Fill default values for commonly used variables
    vars.setdefault("date", datetime.datetime.now().strftime("%d/%m/%Y %H:%M"))
    vars.setdefault("server", "Server")

    # Find template in DB — always scope by guild_id when provided
    gid = str(guild_id) if guild_id else None
    if gid:
        tmpl = db.execute(
            select(EmbedTemplate).where(
                EmbedTemplate.event_type == event_type,
                EmbedTemplate.guild_id == gid,
            )
        ).scalars().first()
    else:
        tmpl = db.execute(
            select(EmbedTemplate).where(EmbedTemplate.event_type == event_type)
        ).scalars().first()

    # Check text mode
    response_mode = "embed"
    if tmpl and tmpl.enabled:
        response_mode = getattr(tmpl, "response_mode", "embed") or "embed"

    if response_mode == "text":
        # Text mode: use text_template with variable substitution
        text_tmpl = getattr(tmpl, "text_template", None) or ""
        if not text_tmpl:
            # Fallback: build text from embed title + description
            parts = []
            if tmpl.title:
                parts.append(f"**{_sub(tmpl.title, vars)}**")
            if tmpl.description:
                parts.append(_sub(tmpl.description, vars))
            for f in (tmpl.fields or []):
                fname = _sub(f.get("name", ""), vars)
                fval = _sub(f.get("value", ""), vars)
                if fname and fval:
                    parts.append(f"**{fname}**: {fval}")
            text_tmpl = "\n".join(parts)
        return _sub(text_tmpl, vars)

    # Embed mode (default)
    if tmpl and tmpl.enabled:
        color = _hex_to_int(tmpl.color or "#5865F2")
        embed = discord.Embed(
            title=_sub(tmpl.title, vars) or None,
            description=_sub(tmpl.description, vars) or None,
            color=color,
        )
        if tmpl.author:
            embed.set_author(name=_sub(tmpl.author, vars))
        if tmpl.footer:
            embed.set_footer(text=_sub(tmpl.footer, vars))
        if tmpl.thumbnail_url:
            embed.set_thumbnail(url=_sub(tmpl.thumbnail_url, vars))
        if tmpl.image_url:
            embed.set_image(url=_sub(tmpl.image_url, vars))
        for f in (tmpl.fields or []):
            embed.add_field(
                name=_sub(f.get("name", ""), vars),
                value=_sub(f.get("value", ""), vars) or "\u200b",
                inline=f.get("inline", True),
            )
    else:
        d = DEFAULTS.get(event_type, {})
        # Per-product fallback: product_123 → san_pham_detail defaults
        if not d and event_type.startswith("product_"):
            d = DEFAULTS.get("san_pham_detail", {})
        color = _hex_to_int(d.get("color", "#5865F2"))
        embed = discord.Embed(
            title=_sub(d.get("title"), vars),
            description=_sub(d.get("description"), vars),
            color=color,
        )
        if d.get("author"):
            embed.set_author(name=_sub(d.get("author"), vars))
        if d.get("footer"):
            embed.set_footer(text=_sub(d.get("footer"), vars))
        if d.get("thumbnail_url"):
            embed.set_thumbnail(url=_sub(d.get("thumbnail_url"), vars))
        if d.get("image_url"):
            embed.set_image(url=_sub(d.get("image_url"), vars))
        for f in d.get("fields", []):
            embed.add_field(
                name=_sub(f.get("name", ""), vars),
                value=_sub(f.get("value", ""), vars) or "\u200b",
                inline=f.get("inline", True),
            )

    embed.timestamp = datetime.datetime.utcnow()
    return embed
