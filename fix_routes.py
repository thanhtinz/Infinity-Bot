import re

with open('src/api/routes.py', 'r') as f:
    content = f.read()

content = content.replace('async def get_config(db: AsyncSession = Depends(get_db)):', 'def get_config(db = Depends(get_db)):')
content = content.replace('async def update_config(config_in: SystemConfigBase, db: AsyncSession = Depends(get_db)):', 'def update_config(config_in: SystemConfigBase, db = Depends(get_db)):')
content = content.replace('async def get_products(db: AsyncSession = Depends(get_db)):', 'def get_products(db = Depends(get_db)):')
content = content.replace('async def create_product(product_in: ProductBase, db: AsyncSession = Depends(get_db)):', 'def create_product(product_in: ProductBase, db = Depends(get_db)):')
content = content.replace('async def get_orders(db: AsyncSession = Depends(get_db)):', 'def get_orders(db = Depends(get_db)):')

content = content.replace('result = await db.execute', 'result = db.execute')
content = content.replace('await db.commit()', 'db.commit()')
content = content.replace('await db.refresh', 'db.refresh')

with open('src/api/routes.py', 'w') as f:
    f.write(content)

print("Fixed async DB calls to sync in routes.py")
