import re

with open('src/bot/manager.py', 'r') as f:
    content = f.read()

content = content.replace('async with async_session() as session:', 'with async_session() as session:')
content = content.replace('result = await session.execute', 'result = session.execute')
content = content.replace('await session.commit()', 'session.commit()')
content = content.replace('await session.flush()', 'session.flush()')

with open('src/bot/manager.py', 'w') as f:
    f.write(content)

print("Fixed async DB calls to sync in manager.py")
