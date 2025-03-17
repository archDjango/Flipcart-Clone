import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TopOffers.css';

const categories = [
  { name: 'Mobiles', image: 'https://image01-in.oneplus.net/media/202406/19/ec64eb41a8e787a798be1b71c13a51bb.png?x-amz-process=image/format,webp/quality,Q_80', link: '/products' },
  { name: 'Electronics', image: 'https://media.istockphoto.com/id/1174598609/photo/set-of-contemporary-house-appliances-isolated-on-white.jpg?s=612x612&w=0&k=20&c=bBMILbCpLkhIxbL7sAAXaFOaFaSXFCt80ccHgl7iiWM=', link: '/products' },
  { name: 'Fashion', image: 'https://static.fibre2fashion.com//articleresources/images/23/2287/SS988ebe_Small.jpg', link: '/products' },
  { name: 'Home & Furniture', image: 'https://5.imimg.com/data5/SELLER/Default/2021/9/JT/XW/BL/137556958/commecial-furniture.jpg', link: '/products' }
];

const TopOffers = () => {
  const navigate = useNavigate();

  return (
    <div className="top-offers">
      {categories.map((category, index) => (
        <div key={index} className="category-card" onClick={() => navigate(category.link)}>
          <img src={category.image} alt={category.name} />
          <p>{category.name}</p>
        </div>
      ))}
    </div>
  );
};

export default TopOffers;
