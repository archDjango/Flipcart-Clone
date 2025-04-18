import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { AuthContext } from '../../context/AuthContext';
import './OrderHeatmap.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const OrderHeatmap = () => {
  const { permissions } = useContext(AuthContext);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!permissions?.analytics?.view) {
      setError('You do not have permission to view analytics');
      setLoading(false);
      return;
    }
    fetchHeatmapData();
  }, [permissions]);

  const fetchHeatmapData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/orders/heatmap', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHeatmapData(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch heatmap data: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = () => {
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const datasets = days.map((day, dayIndex) => ({
      label: day,
      data: hours.map((hour, hourIndex) => {
        const entry = heatmapData.find(d => d.day_of_week === dayIndex + 1 && d.hour === hourIndex);
        return entry ? entry.order_count : 0;
      }),
      backgroundColor: (ctx) => {
        const value = ctx.raw;
        if (value === 0) return 'rgba(255, 255, 255, 0.1)';
        const intensity = Math.min(value / 50, 1);
        return `rgba(255, 99, 132, ${0.3 + intensity * 0.7})`;
      },
      borderColor: 'rgba(255, 99, 132, 0.2)',
      borderWidth: 1,
    }));

    return {
      labels: hours,
      datasets,
    };
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Order Heatmap (Orders by Day and Hour)' },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw} orders`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Hour of Day' } },
      y: { 
        title: { display: true, text: 'Day of Week' },
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
    },
  };

  return (
    <div className="order-heatmap">
      <h2>Order Heatmap</h2>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="spinner">Loading heatmap...</div>
      ) : (
        <Chart type="matrix" data={prepareChartData()} options={options} />
      )}
    </div>
  );
};

export default OrderHeatmap;