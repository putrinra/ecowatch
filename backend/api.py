from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from datetime import datetime

app = Flask(__name__)
CORS(app)

conn = psycopg2.connect(
    database="energy_eco",
    user="postgres",
    password="admin123",
    host="localhost",
    port="5432"
)

@app.route("/energy")
def energy():
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    interval_req = request.args.get('interval', 'Hour')
    areas_req = request.args.get('areas') 

    if not start_date or not end_date:
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = today
        end_date = today

    start_dt = f"{start_date} 00:00:00"
    end_dt = f"{end_date} 23:59:59"

    if interval_req == 'Year':
        pg_interval = '1 year'; trunc_unit = 'year'; time_format = 'YYYY'
    elif interval_req == 'Month':
        pg_interval = '1 month'; trunc_unit = 'month'; time_format = 'YYYY-MM'
    elif interval_req == 'Day':
        pg_interval = '1 day'; trunc_unit = 'day'; time_format = 'YYYY-MM-DD'
    elif interval_req == 'Minute':
        pg_interval = '1 minute'; trunc_unit = 'minute'; time_format = 'YYYY-MM-DD HH24:MI'
    else:
        pg_interval = '1 hour'; trunc_unit = 'hour'; time_format = 'YYYY-MM-DD HH24:00'

    try:
        cursor = conn.cursor()
        query_params = []
        
        if areas_req:
            areas_list = areas_req.split(',')
            placeholders_check = ', '.join(['%s'] * len(areas_list))
            check_query = f"SELECT id, tag_name, parent_id FROM energy_tag WHERE tag_name IN ({placeholders_check})"
            cursor.execute(check_query, tuple(areas_list))
            tag_info = cursor.fetchall()
            
            requested_ids = {row[0] for row in tag_info}
            filtered_areas = []
            for row in tag_info:
                if row[2] not in requested_ids:
                    filtered_areas.append(row[1])
            
            if not filtered_areas: filtered_areas = areas_list
            
            placeholders = ', '.join(['%s'] * len(filtered_areas))
            tag_cte = f"""
            WITH RECURSIVE tag_tree AS (
                SELECT id, id as root_id, tag_name as root_name FROM energy_tag WHERE tag_name IN ({placeholders})
                UNION ALL
                SELECT et.id, tt.root_id, tt.root_name FROM energy_tag et INNER JOIN tag_tree tt ON et.parent_id = tt.id
            )
            """
            query_params.extend(filtered_areas)
        else:
            tag_cte = "WITH RECURSIVE tag_tree AS (SELECT id, id as root_id, tag_name as root_name FROM energy_tag)"

        query_params.extend([start_dt, end_dt])

        query = f"""
            {tag_cte},
            time_series AS (
                SELECT generate_series(%s::timestamp, %s::timestamp, '{pg_interval}'::interval) AS time_bucket
            ),
            base_grid AS (
                SELECT ts.time_bucket, dr.root_id, dr.root_name
                FROM time_series ts
                CROSS JOIN (SELECT DISTINCT root_id, root_name FROM tag_tree) dr
            )
            SELECT 
                bg.root_name AS tag_name,
                COALESCE(SUM(ed.value_kwh), 0) AS value_kwh,
                TO_CHAR(bg.time_bucket, '{time_format}') AS timestamp,
                (SELECT p.tag_name 
                 FROM energy_tag c 
                 JOIN energy_tag p ON c.parent_id = p.id 
                 WHERE c.tag_name = bg.root_name LIMIT 1) as parent_name
            FROM base_grid bg
            LEFT JOIN tag_tree tt ON tt.root_id = bg.root_id
            LEFT JOIN energy_data ed 
                ON ed.tag_id = tt.id 
                AND DATE_TRUNC('{trunc_unit}', ed.timestamp) = bg.time_bucket
            GROUP BY bg.time_bucket, bg.root_name
            ORDER BY bg.time_bucket, bg.root_name;
        """

        cursor.execute(query, tuple(query_params))
        rows = cursor.fetchall()

        data = []
        for row in rows:
            data.append({
                "tag_name": row[0],
                "value_kwh": float(row[1]),
                "timestamp": str(row[2]),
                "parent_name": row[3]
            })

        cursor.close()
        return jsonify(data)

    except Exception as e:
        print("Database Error:", e)
        conn.rollback() 
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)