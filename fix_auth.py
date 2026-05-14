import re

with open('src/api/auth.py', 'r') as f:
    content = f.read()

content = content.replace('async def auth_callback(code: str, request: Request, response: Response, db: AsyncSession = Depends(get_db)):', 'async def auth_callback(code: str, request: Request, response: Response, db = Depends(get_db)):')
content = content.replace('result = await db.execute', 'result = db.execute')

with open('src/api/auth.py', 'w') as f:
    f.write(content)

print("Fixed async DB calls to sync in auth.py")
