import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';

const Signup = () => {
  const { signup } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminCode: '',
    phone: '',
    address: ''
  });

  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword, adminCode, phone, address } = formData;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const result = await signup(name, email, password, adminCode, phone, address);
    if (!result.success) {
      setError(result.message);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="signup-container">
      <h2>Sign Up</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="phone"
          placeholder="Phone (optional)"
          value={formData.phone}
          onChange={handleChange}
        />
        <input
          type="text"
          name="address"
          placeholder="Address (optional)"
          value={formData.address}
          onChange={handleChange}
        />
        <input
          type="text"
          name="adminCode"
          placeholder="Admin Code (optional)"
          value={formData.adminCode}
          onChange={handleChange}
        />
        <button type="submit">Sign Up</button>
      </form>
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
};

export default Signup;