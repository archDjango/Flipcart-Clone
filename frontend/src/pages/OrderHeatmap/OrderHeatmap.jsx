// src/pages/admin/analytics/OrderHeatmap.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import * as d3 from 'd3';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './OrderHeatmap.css';

const OrderHeatmap = () => {
  const { permissions } = useContext(AuthContext);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
  });
  const svgRef = useRef();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!permissions?.analytics?.view) {
      setError('You do not have permission to view analytics');
      setLoading(false);
      return;
    }
    fetchHeatmapData();
  }, [filters, permissions]);

  const fetchHeatmapData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/analytics/order-activity', {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
      });
      setHeatmapData(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load heatmap data: ' + (err.response?.data?.message || 'Unknown error'));
      toast.error('Error fetching heatmap data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (loading || !heatmapData.length) return;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions and margins
    const margin = { top: 50, right: 30, bottom: 50, left: 100 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    const gridSize = Math.floor(width / 24); // 24 hours
    const rowSize = Math.floor(height / 7); // 7 days

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Data setup
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    // Color scale
    const maxOrders = d3.max(heatmapData, d => d.orderCount) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, maxOrders]);

    // X-axis (hours)
    const xScale = d3.scaleBand()
      .range([0, width])
      .domain(hours)
      .padding(0.05);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .style('text-anchor', 'middle')
      .text('Hour of Day');

    // Y-axis (days)
    const yScale = d3.scaleBand()
      .range([0, height])
      .domain(days)
      .padding(0.05);

    svg.append('g')
      .call(d3.axisLeft(yScale));

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .style('text-anchor', 'middle')
      .text('Day of Week');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -margin.top / 2)
      .style('text-anchor', 'middle')
      .style('font-size', '16px')
      .text('Order Activity Heatmap');

    // Draw heatmap cells
    svg.selectAll()
      .data(heatmapData)
      .enter()
      .append('rect')
      .attr('x', d => xScale(`${d.hour}:00`))
      .attr('y', d => yScale(days[d.day]))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', d => colorScale(d.orderCount))
      .style('stroke', 'white')
      .style('stroke-width', 1)
      .on('mouseover', function (event, d) {
        d3.select(this).style('opacity', 0.8);
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', '#333')
          .style('color', '#fff')
          .style('padding', '5px 10px')
          .style('border-radius', '4px')
          .style('pointer-events', 'none')
          .html(`${days[d.day]} at ${d.hour}:00: ${d.orderCount} orders`)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`);
      })
      .on('mouseout', function () {
        d3.select(this).style('opacity', 1);
        d3.selectAll('.tooltip').remove();
      });

    // Find peak order time
    const peakTime = heatmapData.reduce((max, item) =>
      item.orderCount > max.orderCount ? item : max,
      { orderCount: 0, day: 0, hour: 0 }
    );

    // Update peak time display
    d3.select('.peak-time p')
      .text(peakTime.orderCount > 0
        ? `${days[peakTime.day]} at ${peakTime.hour}:00 with ${peakTime.orderCount} orders`
        : 'No orders recorded');

  }, [heatmapData, loading]);

  if (!permissions) {
    return <div className="spinner">Loading permissions...</div>;
  }

  return (
    <div className="order-heatmap">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Order Activity Heatmap</h2>
      {error && <p className="error">{error}</p>}

      <div className="filter-section">
        <div className="filter-group">
          <label>Start Date:</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>
        <div className="filter-group">
          <label>End Date:</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="all">All</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="spinner">Loading heatmap...</div>
      ) : (
        <>
          <div className="heatmap-container">
            <svg ref={svgRef}></svg>
          </div>
          <div className="peak-time">
            <h3>Peak Order Time</h3>
            <p>No orders recorded</p>
          </div>
        </>
      )}
    </div>
  );
};

export default OrderHeatmap;