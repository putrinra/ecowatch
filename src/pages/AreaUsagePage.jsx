import React, { useState, useEffect } from "react";
import { Card, Select, DatePicker, Button, Space, message } from "antd";
import ReactECharts from "echarts-for-react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import "../style/AreaUsage.css";

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AreaUsagePage() {
  const { isDarkMode } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState(() => {
    return sessionStorage.getItem("savedInterval") || "Hour";
  });
  const [dateRange, setDateRange] = useState(null);
  const [chartData, setChartData] = useState([]);

  const fetchData = () => {
    let url = `http://localhost:5000/energy?interval=${intervalWaktu}`;

    if (dateRange && dateRange.length === 2) {
      const startDate = dateRange[0].format("YYYY-MM-DD");
      const endDate = dateRange[1].format("YYYY-MM-DD");
      url += `&start=${startDate}&end=${endDate}`;
    }

    sessionStorage.setItem("savedInterval", intervalWaktu);
    sessionStorage.setItem("savedEnergyUrl", url);

    axios.get(url)
      .then(res => {
        const dataArray = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setChartData(dataArray);
      })
      .catch(err => {
        console.error("Error mengambil data:", err);
      });
  };

  useEffect(() => {
    const savedUrl = sessionStorage.getItem("savedEnergyUrl");
    
    if (savedUrl) {
      axios.get(savedUrl)
        .then(res => {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data.data || []);
          setChartData(dataArray);
        })
        .catch(err => console.error("Error mengambil data:", err));
    } else {
      fetchData();
    }
  }, []);
  const xAxisData = [...new Set(chartData.map(d => d.timestamp))].sort();
  const tags = [...new Set(chartData.map(d => d.tag_name))];

  const series = tags.map(tag => ({
    name: tag,
    type: "bar",
    stack: "Total",
    emphasis: { focus: "series" },
    data: xAxisData.map(time => {
      const item = chartData.find(d => d.tag_name === tag && d.timestamp === time);
      return item ? item.value_kwh : 0;
    })
  }));

  const areaUsageOption = {
    tooltip: {trigger: "axis"},
    legend: {bottom: 0, type: "scroll", textStyle: {color: isDarkMode ? "#d9d9d9" : "#595959"}},
    grid: {top: "5%", left: "3%", right: "4%", bottom: "80px", containLabel: true},
    dataZoom: [{type: "slider", bottom: 35, height: 15}, {type: "inside"}],
    xAxis: {type: "category", data: xAxisData, axisLabel: {
        color: isDarkMode ? "#d9d9d9" : "#595959"
      }
    },
    yAxis: {type: "value", name: "kWh",
      nameTextStyle: {
        color: isDarkMode ? "#d9d9d9" : "#595959"
      },
      axisLabel: {
        color: isDarkMode ? "#d9d9d9" : "#595959"
      }
    },
    series: series
  };

  return (
    <div className="area-usage-container">
      <Card styles={{ body: { padding: "10px 24px", overflowX: "auto" } }} className="full-width-card">
        <Space size="middle" wrap={false} className="filter-wrapper">
          
          <Space size="small">
            <span className="filter-label">Energy item</span>
            <Select defaultValue="Electricity" className="select-energy">
              <Option value="Electricity">Electricity</Option>
            </Select>
          </Space>

          <Space size="small">
            <span className="filter-label">Interval</span>
            <Select value={intervalWaktu} onChange={setIntervalWaktu} className="select-interval">
              <Option value="Year">Year</Option>
              <Option value="Month">Month</Option>
              <Option value="Day">Day</Option>
              <Option value="Hour">Hour</Option>
              <Option value="Minute">Minute</Option>
            </Select>
          </Space>

          <Space size="small">
            <span className="filter-label">Time</span>
            <RangePicker 
              className="picker-time" 
              onChange={(dates) => setDateRange(dates)} 
            />
          </Space>

          <Button type="primary" onClick={fetchData}>Search</Button>

        </Space>
      </Card>

      <Card title="Area Usage" variant="borderless" className="full-width-card" style={{ marginTop: '5px' }}>
        <ReactECharts
          option={areaUsageOption}
          theme={isDarkMode ? "dark" : "light"}
          style={{ height: "620px", width: "100%" }}
        />
      </Card>
    </div>
  );
}
