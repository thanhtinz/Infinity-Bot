import os
import psycopg2

db_url = os.environ.get("DB8624B53A_DATABASE_URL")
if db_url:
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        conn.close()
        print("Success")
    except Exception as e:
        print(f"Error: {e}")
