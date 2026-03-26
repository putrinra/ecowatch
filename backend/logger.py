from pymodbus.client import ModbusTcpClient
import psycopg2
from datetime import datetime
import time

# koneksi modbus
client = ModbusTcpClient("127.0.0.1", port=502)
client.connect()

print("Modbus connected:", client.connected)

# koneksi database
conn = psycopg2.connect(
    database="energy_eco",
    user="postgres",
    password="admin123",
    host="localhost",
    port="5432"
)

cursor = conn.cursor()

print("Database connected")

while True:

    cursor.execute("SELECT id, tag_name, modbus_address FROM energy_tag")
    tags = cursor.fetchall()

    for tag in tags:

        tag_id, tag_name, address = tag

        try:

            # konversi address 40001 → 0
            modbus_address = address - 40001

            print("Reading:", tag_name, "address:", modbus_address)

            result = client.read_holding_registers(address=modbus_address, count=1)

            if result.isError():

                print("Modbus error:", tag_name)

            else:

                value = result.registers[0]

                print("Value:", value)

                cursor.execute(
                    """
                    INSERT INTO energy_data(tag_id,value_kwh,timestamp)
                    VALUES (%s,%s,%s)
                    """,
                    (tag_id, value, datetime.now())
                )

                print("Inserted to DB")

        except Exception as e:

            print("Error:", e)

    conn.commit()

    print("Waiting next logging...\n")

    time.sleep(5)