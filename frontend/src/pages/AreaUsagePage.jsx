import React, { useState, useEffect, useMemo } from "react";
import { Card, Select, DatePicker, Button, Space, message, Spin, Segmented, ConfigProvider, Divider, Dropdown } from "antd";
import { DotLoader } from "react-spinners";
import ReactECharts from "echarts-for-react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { RefreshCw, Download, BarChart2, LineChart, FileText, Table } from "lucide-react";
import dayjs from "dayjs"; 
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import "../style/AreaUsage.css";

const { Option } = Select;
const { RangePicker } = DatePicker;

const BASE_URL = import.meta.env.VITE_API_URL || 'http://LAPTOP-KJ75ERV3:5000';

export default function AreaUsagePage() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState(() => {
    return sessionStorage.getItem("savedInterval") || "Day";
  });
  
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'd'), 
    dayjs()
  ]);
  
  const [chartData, setChartData] = useState([]);
  const [compChartData, setCompChartData] = useState([]); 
  
  const [loading, setLoading] = useState(false);
  
  const [chartType, setChartType] = useState('bar'); 
  const [comparisonMode, setComparisonMode] = useState('Target energy'); 

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${BASE_URL}/energy?interval=${intervalWaktu}`;
      let compUrl = `${BASE_URL}/energy?interval=${intervalWaktu}`;

      if (dateRange && dateRange[0] && dateRange[1]) {
        const startDate = dateRange[0].format("YYYY-MM-DD");
        const endDate = dateRange[1].format("YYYY-MM-DD");
        url += `&start=${startDate}&end=${endDate}`;

        if (comparisonMode === 'YoY') {
          const startYoY = dateRange[0].subtract(1, 'year').format("YYYY-MM-DD");
          const endYoY = dateRange[1].subtract(1, 'year').format("YYYY-MM-DD");
          compUrl += `&start=${startYoY}&end=${endYoY}`;
        } else if (comparisonMode === 'MoM') {
          const startMoM = dateRange[0].subtract(1, 'month').format("YYYY-MM-DD");
          const endMoM = dateRange[1].subtract(1, 'month').format("YYYY-MM-DD");
          compUrl += `&start=${startMoM}&end=${endMoM}`;
        }
      }

      if (checkedAreaNames && checkedAreaNames.length > 0) {
        const areaStr = checkedAreaNames.join(",");
        url += `&areas=${areaStr}`;
        compUrl += `&areas=${areaStr}`;
      }

      sessionStorage.setItem("savedInterval", intervalWaktu);

      const res = await axios.get(url);
      const dataArray = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setChartData(dataArray);

      if (comparisonMode !== 'Target energy') {
        const resComp = await axios.get(compUrl);
        const compArray = Array.isArray(resComp.data) ? resComp.data : (resComp.data.data || []);
        setCompChartData(compArray);
      } else {
        setCompChartData([]);
      }
    } catch (err) {
      console.error("Error to fetch data:", err);
      message.error("Error to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [checkedAreaNames, comparisonMode]);

  const handleExportCSV = () => {
    if (!chartData || chartData.length === 0) {
      message.warning("No data available for export!");
      return;
    }
    const headers = ["Timestamp", "Area/Tag Name", "Value (kWh)"];
    const rows = chartData.map(d => `${d.timestamp},${d.tag_name},${d.value_kwh}`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AreaUsage_RAW_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("Raw Data (CSV) exported successfully!");
  };

  const handleExportExcel = async () => {
    if (!chartData || chartData.length === 0) {
      message.warning("No data available for export!");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Energy Usage');

    worksheet.columns = [
      { header: 'Waktu (Timestamp)', key: 'timestamp', width: 25 },
      { header: 'Nama Area / Tag', key: 'tag_name', width: 25 },
      { header: 'Penggunaan (kWh)', key: 'value', width: 20 }
    ];

    chartData.forEach(d => {
      worksheet.addRow({
        timestamp: d.timestamp,
        tag_name: d.tag_name,
        value: parseFloat(d.value_kwh) || 0
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
          if (colNumber === 3) {
            cell.numFmt = '#,##0.00 "kWh"';
            cell.alignment = { horizontal: 'right' };
          }
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `AreaUsage_OfficialReport_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    message.success("Report exported successfully!");
  };

  const exportMenu = {
    items: [
      {
        key: 'excel',
        label: 'Download Excel',
        icon: <Table size={16} />,
        onClick: handleExportExcel 
      },
      {
        key: 'csv',
        label: 'Download CSV',
        icon: <FileText size={16} />,
        onClick: handleExportCSV 
      }
    ]
  };

  const rangePresets = [
    { label: '7 Days Ago', value: [dayjs().subtract(7, 'd'), dayjs()] },
    { label: '30 Days Ago', value: [dayjs().subtract(30, 'd'), dayjs()] },
    { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
    { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  ];

  const areaUsageOption = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        backgroundColor: 'transparent',
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, type: "scroll", textStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" } },
        grid: { top: "5%", left: "3%", right: "4%", bottom: "80px", containLabel: true },
        title: { 
          text: "Data not available", 
          left: "center", top: "center",
          textStyle: { color: isDarkMode ? '#d9d9d9' : '#888', fontWeight: 'normal', fontSize: 14 }
        },
        series: [] 
      };
    }

    const xAxisData = [...new Set(chartData.map(d => d.timestamp))].sort();
    const tags = [...new Set(chartData.map(d => d.tag_name))];

    const dataMap = {};
    chartData.forEach(d => {
      if (!dataMap[d.tag_name]) dataMap[d.tag_name] = {};
      dataMap[d.tag_name][d.timestamp] = d.value_kwh;
    });

    const compDataMap = {};
    if (comparisonMode !== 'Target energy' && compChartData.length > 0) {
      compChartData.forEach(d => {
        if (!compDataMap[d.tag_name]) compDataMap[d.tag_name] = [];
        compDataMap[d.tag_name].push(d.value_kwh);
      });
    }

    const series = [];
    tags.forEach(tag => {
      series.push({
        name: tag,
        type: chartType,
        stack: chartType === 'bar' ? 'Total' : null, 
        emphasis: { focus: "series" },
        smooth: true,
        data: xAxisData.map(time => dataMap[tag]?.[time] || 0)
      });

      if (comparisonMode !== 'Target energy') {
        series.push({
          name: `${tag} (${comparisonMode})`,
          type: chartType,
          stack: chartType === 'bar' ? 'CompTotal' : null,
          smooth: true,
          lineStyle: { type: 'dashed', width: 2 },
          itemStyle: { opacity: 0.6 },
          data: xAxisData.map((_, index) => compDataMap[tag]?.[index] || 0)
        });
      }
    });

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, type: "scroll", textStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" } },
      grid: { top: "5%", left: "3%", right: "4%", bottom: "80px", containLabel: true },
      dataZoom: [{ type: "slider", bottom: 35, height: 15 }, { type: "inside" }],
      xAxis: { type: "category", data: xAxisData, axisLabel: { color: isDarkMode ? "#d9d9d9" : "#595959" } },
      yAxis: { 
        type: "value", name: "kWh", 
        nameTextStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" },
        axisLabel: { color: isDarkMode ? "#d9d9d9" : "#595959" },
        splitLine: { lineStyle: { color: isDarkMode ? "#303030" : "#e8e8e8", type: "dashed" } } 
      },
      series: series
    };
  }, [chartData, compChartData, isDarkMode, chartType, comparisonMode]);

  const controlTheme = {
    components: {
      Segmented: {
        itemSelectedBg: isDarkMode ? '#112a45' : '#e6f4ff',
        itemSelectedColor: isDarkMode ? '#69c0ff' : '#1677ff',
        itemColor: isDarkMode ? '#a6a6a6' : '#8c8c8c',
        trackBg: isDarkMode ? '#141414' : '#ffffff',
      },
    },
  };

  const extraControls = (
    <Space size="middle" wrap align="center">
      <ConfigProvider theme={controlTheme}>
        <Segmented 
          options={['Target energy', 'YoY', 'MoM']} 
          value={comparisonMode} onChange={setComparisonMode} 
          style={{ border: isDarkMode ? '1px solid #303030' : '1px solid #d9d9d9' }}
        />
        <Divider type="vertical" style={{ height: '20px', margin: '0 4px' }} />
        <Segmented 
          options={[
            { value: 'line', icon: <LineChart size={18} style={{ marginTop: 4 }} /> },
            { value: 'bar', icon: <BarChart2 size={18} style={{ marginTop: 4 }} /> }
          ]}
          value={chartType} onChange={setChartType} 
        />
      </ConfigProvider>

      <Space size="small">
        <Button type="text" icon={<RefreshCw size={18} />} loading={loading} onClick={fetchData} style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }} />
        
        <Dropdown menu={exportMenu} placement="bottomRight" trigger={['click']}>
          <Button type="text" icon={<Download size={18} />} style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }} />
        </Dropdown>
      </Space>
    </Space>
  );

  return (
    <div className="area-usage-container">
      <Card styles={{ body: { padding: "10px 24px" } }} className="full-width-card">
        <Space size="middle" wrap className="filter-wrapper">
          <Space>
            <span className="filter-label">Energy item</span>
            <Select defaultValue="Electricity" style={{ width: 120 }}>
              <Option value="Electricity">Electricity</Option>
            </Select>
          </Space>
          <Space>
            <span className="filter-label">Interval</span>
            <Select value={intervalWaktu} onChange={setIntervalWaktu} style={{ width: 100 }}>
              <Option value="Year">Year</Option>
              <Option value="Month">Month</Option>
              <Option value="Day">Day</Option>
              <Option value="Hour">Hour</Option>
            </Select>
          </Space>
          <Space>
            <span className="filter-label">Time</span>
            <RangePicker 
              value={dateRange} 
              presets={rangePresets}
              onChange={(dates) => setDateRange(dates)} 
            />
          </Space>
          <Button type="primary" onClick={fetchData}>Search</Button>
        </Space>
      </Card>

      <Card title="Area Usage" variant="borderless" style={{ marginTop: '5px' }} extra={extraControls}>
        <Spin spinning={loading} indicator={<DotLoader color="#1890ff" size={40} />}>
          <ReactECharts option={areaUsageOption} notMerge={true} style={{ height: "620px", width: "100%" }} />
        </Spin>
      </Card>
    </div>
  );
}
