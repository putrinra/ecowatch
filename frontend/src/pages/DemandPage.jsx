import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, Table, message, Spin, Dropdown } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { RefreshCw, Download, FileText, Table as TableIcon } from "lucide-react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import '../style/Demand.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://LAPTOP-KJ75ERV3:5000';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function DemandPage() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();
  
  const [intervalWaktu, setIntervalWaktu] = useState('Hour'); 
  
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'd'), 
    dayjs()
  ]);
  
  const [loading, setLoading] = useState(false);
  const [chartXAxis, setChartXAxis] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [tableData, setTableData] = useState([]);

  const fetchDemandData = async () => {
    if (!dateRange || dateRange.length !== 2) {
      message.warning('Choose a date range first!');
      return;
    }

    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      
      let url = `${BASE_URL}/energy?interval=${intervalWaktu}&start=${start}&end=${end}`;
      if (checkedAreaNames && checkedAreaNames.length > 0) {
        url += `&areas=${checkedAreaNames.join(',')}`;
      } else {
        url += `&areas=MAIN_ELECTRICAL`;
      }
      
      const response = await axios.get(url);
      const rawData = response.data || [];

      const aggregatedData = {};

      rawData.forEach((item) => {
        if (!aggregatedData[item.timestamp]) {
          aggregatedData[item.timestamp] = 0;
        }
        aggregatedData[item.timestamp] += parseFloat(item.value_kwh);
      });

      const timestamps = Object.keys(aggregatedData).sort();
      
      const xData = [];
      const sData = [];
      const tData = [];

      timestamps.forEach((ts, index) => {
        const val = aggregatedData[ts];
        xData.push(ts);
        sData.push(val);

        const [datePart, timePart] = ts.split(' ');
        tData.push({
          key: index.toString(),
          date: datePart,
          period: 'All time',
          demand: val.toFixed(2),
          time: timePart || '00:00'
        });
      });

      setChartXAxis(xData);
      setChartSeries(sData);
      setTableData(tData.reverse());

    } catch (error) {
      console.error('Failed to fetch demand data:', error);
      message.error('Failed to load data from server!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandData();
  }, [checkedAreaNames]);

  const handleExportCSV = () => {
    if (!tableData || tableData.length === 0) {
      message.warning("No data available for export!");
      return;
    }

    const headers = ["Date", "Electricity Period", "Demand (kW)", "Time"];
    const rows = tableData.map(d => `${d.date},${d.period},${d.demand},${d.time}`);
    
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DemandData_RAW_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success("Raw Data (CSV) exported successfully!");
  };

  const handleExportExcel = async () => {
    if (!tableData || tableData.length === 0) {
      message.warning("No data available for export!");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Demand Data');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Electricity Period', key: 'period', width: 25 },
      { header: 'Demand (kW)', key: 'demand', width: 20 },
      { header: 'Time', key: 'time', width: 15 },
    ];

    tableData.forEach(d => {
      worksheet.addRow({
        date: d.date,
        period: d.period,
        demand: parseFloat(d.demand) || 0,
        time: d.time
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
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
            cell.numFmt = '#,##0.00 "kW"';
            cell.alignment = { horizontal: 'right' };
          }
          if (colNumber === 1 || colNumber === 4) {
            cell.alignment = { horizontal: 'center' };
          }
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `DemandData_OfficialReport_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);

    message.success("Official Report (Excel) exported successfully!");
  };

  const exportMenu = {
    items: [
      {
        key: 'excel',
        label: 'Download Excel',
        icon: <TableIcon size={16} />,
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
    { label: 'Hari Ini', value: [dayjs(), dayjs()] },
    { label: '7 Hari Terakhir', value: [dayjs().subtract(7, 'd'), dayjs()] },
    { label: '30 Hari Terakhir', value: [dayjs().subtract(30, 'd'), dayjs()] },
    { label: 'Bulan Ini', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
    { label: 'Bulan Lalu', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  ];

  const seriesName = (checkedAreaNames && checkedAreaNames.length > 0) 
    ? (checkedAreaNames.length === 1 ? checkedAreaNames[0] : 'Total Selected Areas')
    : 'Demand (MAIN_ELECTRICAL)';

  const demandOption = {
    tooltip: { trigger: 'axis' },
    grid: { top: '13%', left: '3%', right: '3%', bottom: '50px', containLabel: true },
    dataZoom: [
      { type: 'inside', start: 0, end: 100, height: 15 }, 
      { type: 'slider', bottom: 0, height: 20 }
    ],
    xAxis: { 
      type: 'category', 
      boundaryGap: false,
      data: chartXAxis,
      axisLabel: { color: isDarkMode ? '#d9d9d9' : '#595959' }
    },
    yAxis: { 
      type: 'value', 
      name: 'kW', 
      nameTextStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
      axisLabel: { color: isDarkMode ? '#d9d9d9' : '#595959' },
      splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } } 
    },
    series: [
      {
        name: seriesName,
        type: 'line',
        data: chartSeries,
        itemStyle: { color: '#52c41a' },
        lineStyle: { width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(82, 196, 26, 0.6)' },
            { offset: 1, color: 'rgba(82, 196, 26, 0.05)' }
          ])
        },
        markPoint: {
          data: [{ type: 'max', name: 'Peak Demand' }],
          itemStyle: { color: '#52c41a' },
          label: { color: '#fff', fontWeight: 'bold' }
        }
      }
    ]
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date', align: 'center' },
    { title: 'Electricity period', dataIndex: 'period', key: 'period' },
    { title: 'Demand (kW)', dataIndex: 'demand', key: 'demand', align: 'right' },
    { title: 'Time', dataIndex: 'time', key: 'time', align: 'center' },
  ];

  const extraControls = (
    <Space size="small">
      <Button 
        type="text" 
        icon={<RefreshCw size={18} />}
        loading={loading} 
        onClick={fetchDemandData}
        style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }}
        title="Refresh Data"
      />
      <Dropdown menu={exportMenu} placement="bottomRight" trigger={['click']}>
        <Button 
          type="text" 
          icon={<Download size={18} />} 
          style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }} 
          title="Download Data"
        />
      </Dropdown>
    </Space>
  );

  return (
    <div className="demand-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      
      <Card styles={{ body: { padding: '10px 24px' } }} style={{ flex: '0 0 auto' }}>
        <div className="demand-filter-wrapper">
          <Space wrap>
            <span>Interval</span>
            <Select 
              value={intervalWaktu} 
              onChange={setIntervalWaktu} 
              className="demand-select"
              style={{ width: 120 }}
            >
              <Option value="Minute">Minute</Option>
              <Option value="Hour">Hour</Option>
            </Select>
            <span className="demand-label-time" style={{ marginLeft: 16 }}>Time</span>
            
            <RangePicker 
              value={dateRange}
              presets={rangePresets}
              onChange={(dates) => setDateRange(dates)}
              allowClear={false}
            />
            
            <Button type="primary" className="demand-btn-search" onClick={fetchDemandData} loading={loading}>
              Search
            </Button>
          </Space>
        </div>
      </Card>

      <Card title="Demand" bordered={false} extra={extraControls} style={{ marginTop: 5, flex: '0 0 auto' }}>
        <Spin spinning={loading}>
          <ReactECharts 
            notMerge={true} 
            option={demandOption}
            className="demand-chart" 
            style={{ height: 'calc(40vh - 70px)', minHeight: '220px', width: '100%' }} 
          />
        </Spin>
      </Card>

      <Card 
        title="Data analysis" 
        bordered={false} 
        style={{ marginTop: 5, flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, paddingBottom: 0 } }}
      >
        <Table 
          dataSource={tableData} 
          columns={columns} 
          size="small" 
          scroll={{ y: 'calc(40vh - 90px)' }} 
          loading={loading}
          pagination={{
            showSizeChanger: true, 
            showQuickJumper: true, 
            showTotal: (total) => `Total ${total} data`, 
            defaultPageSize: 10, 
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
      </Card>
    </div>
  );
}
