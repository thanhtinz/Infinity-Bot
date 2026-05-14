# Autoresponder Feature

## Context
User wants a professional autoresponder — automatic replies triggered by message content (keywords, regex, etc.), distinct from Custom Commands which use prefix `!`.

## Scope
- Full CRUD for autoresponder rules via dashboard
- Bot cog listening to `on_message`, matching triggers, sending responses
- Feature toggle integration (`autoresponder` key)
- Support text, embed, and reaction responses
- Cooldown, channel/role restrictions
- **No** embed builder events (autoresponder responses are fully customized per-rule, not event templates)

## Non-Goals (deferred)
- AI-powered auto-reply
- Import/export rules
- Analytics/stats per rule

## Implementation Plan

### 1. Model — `src/models/models.py`
Add `AutoResponder` class after `CustomCommand`:
```python
class AutoResponder(Base):
    __tablename__ = "auto_responders"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, nullable=False)              # rule name for dashboard
    trigger_type = Column(String, default="contains")  # exact, contains, startswith, endswith, regex, wildcard
    trigger_text = Column(String, nullable=False)       # the trigger pattern
    ignore_case = Column(Boolean, default=True)
    response_type = Column(String, default="text")      # text, embed, react, text+react, embed+react
    response_text = Column(Text, nullable=True)
    response_embed = Column(JSON, nullable=True)
    reaction_emojis = Column(JSON, default=list)        # list of emoji to react
    reply_to_message = Column(Boolean, default=True)    # reply vs send in channel
    delete_trigger = Column(Boolean, default=False)
    send_dm = Column(Boolean, default=False)            # DM user instead
    cooldown = Column(Integer, default=0)               # seconds, per user
    cooldown_type = Column(String, default="per_user")  # per_user, per_channel, global
    allowed_channels = Column(JSON, default=list)       # empty = all
    blocked_channels = Column(JSON, default=list)
    allowed_roles = Column(JSON, default=list)          # empty = all
    blocked_roles = Column(JSON, default=list)
    ignore_bots = Column(Boolean, default=True)
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)               # higher = checked first
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
```

### 2. Migration — `src/database/config.py`
Add `auto_responders` table check after `custom_commands` migration block — using `create_all()` (new table, not ALTER).

### 3. API Routes — `src/api/routes/autoresponder.py`
CRUD endpoints following `custom_commands.py` pattern:
- `GET /auto-responders` — list all rules
- `POST /auto-responders` — create rule
- `PUT /auto-responders/{id}` — update rule
- `DELETE /auto-responders/{id}` — delete rule
- `PUT /auto-responders/{id}/toggle` — quick enable/disable

Register in `src/api/routes/__init__.py`.

### 4. Feature Toggle — `src/api/routes/features.py`
Add entry to `FEATURE_DEFS`:
```python
{"key": "autoresponder", "label": "Auto Responder", "desc": "Tự động trả lời theo keyword", "icon": "MessageCircleReply", "cogs": ["AutoResponderCog"]}
```

### 5. Bot Cog — `src/bot/cogs/autoresponder.py`
- Listener `on_message` with `check_feature(self)`
- Load rules from DB (with caching — refresh every 30s or on invalidation)
- Match logic: iterate rules by priority desc, check trigger_type against message.content
- Apply channel/role filters, cooldown
- Send response (text/embed), add reactions, handle reply/DM/delete
- Reuse `_build_vars` and `_substitute` from custom_commands (extract to shared util or copy)
- Register in `manager.py`: import, add to `_COG_FEATURE_MAP` and `cogs` list

### 6. Dashboard UI — `src/pages/AutoResponder.tsx`
Follow existing page patterns (CustomCommands.tsx style):
- **List view**: cards with rule name, trigger preview, trigger type badge, status toggle, match count
- **Edit dialog** (full-screen Dialog):
  - **Trigger section**: name, trigger_type select, trigger_text input, ignore_case toggle
  - **Response section**: response_type tabs (Text / Embed / Reaction), response_text with variable panel, embed builder, emoji picker for reactions
  - **Settings section** (Collapsible): reply vs send, delete trigger, send DM, cooldown + cooldown_type, priority
  - **Restrictions section** (Collapsible): allowed/blocked channels (ChannelSelect), allowed/blocked roles (MultiRoleSelect), ignore bots
- Variable reference panel (reuse from CustomCommands)
- Empty state with illustration

### 7. Routing — `src/App.tsx`
- Add lazy import for AutoResponder page
- Add route `/autoresponder`
- Add to sidebar "Tiện ích" group: `{ to: "/autoresponder", icon: MessageCircleReply, label: "Auto Responder", feature: "autoresponder" }`
- Add `MessageCircleReply` to lucide imports

## Files to Create
| File | Purpose |
|---|---|
| `src/bot/cogs/autoresponder.py` | Bot cog |
| `src/api/routes/autoresponder.py` | API routes |
| `src/pages/AutoResponder.tsx` | Dashboard page |

## Files to Modify
| File | Change |
|---|---|
| `src/models/models.py` | Add `AutoResponder` model |
| `src/database/config.py` | No migration needed (new table → `create_all()` handles it) |
| `src/api/routes/__init__.py` | Register autoresponder router |
| `src/api/routes/features.py` | Add `autoresponder` to `FEATURE_DEFS` |
| `src/bot/manager.py` | Import + register `AutoResponderCog` |
| `src/App.tsx` | Add route, sidebar item, lazy import |

## Verification
1. Start app → navigate to Auto Responder page → create a rule
2. API test: `curl /api/auto-responders`
3. Bot test: send matching message in Discord → bot responds
4. Toggle feature off → bot stops responding
5. Test each trigger type: exact, contains, startswith, endswith, regex
6. Test cooldown, channel restriction, role restriction
