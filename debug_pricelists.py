
import sqlite3

db_path = r'C:\Users\pedro\OneDrive\APPS\GitHub\odoo-universal-importer\server\data\importer.db'
brand_id = 'a56b5943-953d-4879-9936-719cdf35ad29'

print(f"Checking Pricelists for Brand {brand_id} at {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, filename, uploaded_at, data_path FROM ce_pricelists WHERE brand_profile_id = ?", (brand_id,))
    pricelists = cursor.fetchall()
    print(f"\nFound {len(pricelists)} pricelists:")
    for pl in pricelists:
        print(f"ID: {pl[0]} | Filename: {pl[1]} | Path: {pl[3]}")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
