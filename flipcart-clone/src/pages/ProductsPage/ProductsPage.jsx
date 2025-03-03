import React, { useState, useMemo, useEffect } from 'react';
import Filters from '../../components/Filters.jsx';
import ProductCard from '../../components/ProductCard/ProductCard.jsx';
import './ProductsPage.css';

const products = [
  {
    id: 1,
    name: 'Samsung Galaxy S21',
    price: 54999,
    category: 'Electronics',
    brand: 'Samsung',
    rating: 4.5,
    image: 'https://m.media-amazon.com/images/I/61-kjUCw1OL.jpg',
  },
  {
    id: 2,
    name: 'Nike Air Max 270',
    price: 8999,
    category: 'Fashion',
    brand: 'Nike',
    rating: 4.7,
    image: 'https://static.nike.com/a/images/t_default/1518d6fb-ded7-45af-a879-6e1c130f1a95/W+AIR+MAX+270.png',
  },
  {
    id: 3,
    name: 'Sony WH-1000XM5 Headphones',
    price: 29999,
    category: 'Electronics',
    brand: 'Sony',
    rating: 4.8,
    image: 'https://www.sony.co.in/image/6145c1d32e6ac8e63a46c912dc33c5bb?fmt=pjpeg&wid=330&bgcolor=FFFFFF&bgc=FFFFFF',
  },
  {
    id: 4,
    name: 'Whirlpool 265L Refrigerator',
    price: 23990,
    category: 'Appliances',
    brand: 'Whirlpool',
    rating: 4.4,
    image: 'data:image/jpeg;base64,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',
  },
  {
    id: 5,
    name: 'Levi\'s Men\'s Slim Fit Jeans',
    price: 2999,
    category: 'Fashion',
    brand: 'Levi\'s',
    rating: 4.6,
    image: 'https://levi.in/cdn/shop/files/182981482_01_Front_4b14f5bd-3c6a-4603-acda-096c5675d825.jpg?v=1740488440',
  },
  {
    id: 6,
    name: 'Apple iPhone 14',
    price: 71999,
    category: 'Electronics',
    brand: 'Apple',
    rating: 4.9,
    image: 'https://iplanet.one/cdn/shop/files/iPhone_14_Plus_Purple_PDP_Image_Position-1A__WWEN_83fdac5e-e53f-4732-b628-48e9fe01a8f7.jpg?v=1691140605&width=1445',
  },
  {
    id: 7,
    name: 'Puma Running Shoes',
    price: 4999,
    category: 'Fashion',
    brand: 'Puma',
    rating: 4.3,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQc-khGdn5D8CxTvZVN_YuEgAWlYn409yNUdg&s',
  },
  {
    id: 8,
    name: 'Sony Bravia 55" 4K TV',
    price: 64990,
    category: 'Electronics',
    brand: 'Sony',
    rating: 4.7,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9LjpLKG_HzxXXFOAiAZwuML-9_iiWUMjAtw&s',
  },
  {
    id: 9,
    name: 'LG Washing Machine 7kg',
    price: 20990,
    category: 'Appliances',
    brand: 'LG',
    rating: 4.5,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7_fjzW9aaPjBsCOVSo1kxvaGZv1fmjWkaJw&s',
  },
  {
    id: 10,
    name: 'Philips Air Fryer',
    price: 7990,
    category: 'Appliances',
    brand: 'Philips',
    rating: 4.4,
    image: 'https://images.philips.com/is/image/philipsconsumer/vrs_57e878680d2ea0618b1639cc9185041de75a8c59?$pnglarge$&wid=1250',
  },
  {
    id: 11,
    name: 'Adidas Sports T-Shirt',
    price: 1999,
    category: 'Fashion',
    brand: 'Adidas',
    rating: 4.6,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTCKMLAkbEcI5MeGvWiI7EJllztHEttJQ21QQ&s',
  },
  {
    id: 12,
    name: 'Realme Narzo 60 5G',
    price: 17999,
    category: 'Electronics',
    brand: 'Realme',
    rating: 4.3,
    image: 'https://www.jiomart.com/images/product/original/rv0eb044tn/realme-narzo-70x-5g-6gb-ram-128gb-rom-ice-blue-smartphone-product-images-orv0eb044tn-p608949202-0-202405091539.jpg?im=Resize=(420,420)',
  },
  {
    id: 13,
    name: 'Samsung 32" Smart LED TV',
    price: 16990,
    category: 'Electronics',
    brand: 'Samsung',
    rating: 4.4,
    image: 'https://images.samsung.com/is/image/samsung/p6pim/in/ua32t4380akxxl/gallery/in-hd-tv-ua32t4380akxxl-ua--t----akxxl-533607545?$1300_1038_PNG$',
  },
  {
    id: 14,
    name: 'Tata Salt 1kg',
    price: 28,
    category: 'Home Essentials',
    brand: 'Tata',
    rating: 4.8,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTQOktBNXEhpDa4N53N-JFYeVsLZ_cvRY-W5w&s',
  },
  {
    id: 15,
    name: 'Prestige Gas Stove',
    price: 3199,
    category: 'Home Essentials',
    brand: 'Prestige',
    rating: 4.5,
    image: 'https://m.media-amazon.com/images/I/618eYg68w+L._AC_UF894,1000_QL80_.jpg',
  },
  {
    id: 16,
    name: 'Bajaj Mixer Grinder',
    price: 2799,
    category: 'Appliances',
    brand: 'Bajaj',
    rating: 4.2,
    image: 'https://shop.bajajelectricals.com/cdn/shop/files/410570_default.jpg?v=1724391874',
  },
  {
    id: 17,
    name: 'Fossil Gen 6 Smartwatch',
    price: 23999,
    category: 'Electronics',
    brand: 'Fossil',
    rating: 4.5,
    image: 'https://example.com/fossil-watch.jpg',
  },
  {
    id: 18,
    name: 'Boat Rockerz 255 Pro+',
    price: 1599,
    category: 'Electronics',
    brand: 'Boat',
    rating: 4.4,
    image: 'https://example.com/boat-earphones.jpg',
  },
  {
    id: 19,
    name: 'Wildcraft Backpack',
    price: 1899,
    category: 'Fashion',
    brand: 'Wildcraft',
    rating: 4.6,
    image: 'https://example.com/wildcraft-bag.jpg',
  },
  {
    id: 20,
    name: 'Philips Trimmer',
    price: 1199,
    category: 'Home Essentials',
    brand: 'Philips',
    rating: 4.5,
    image: 'https://example.com/philips-trimmer.jpg',
  },
  // You can continue adding more products similarly...
];



const ProductsPage = () => {
  const [filter, setFilter] = useState({ category: '' });
  const [sortOrder, setSortOrder] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000); // Simulating loading
  }, []);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (filter.category) result = result.filter(product => product.category === filter.category);
    if (sortOrder === 'low-to-high') result.sort((a, b) => a.price - b.price);
    if (sortOrder === 'high-to-low') result.sort((a, b) => b.price - a.price);
    return result;
  }, [filter, sortOrder]);

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  return (
    <div className="products-page">
      <Filters setFilter={setFilter} setSortOrder={setSortOrder} />
      {loading ? (
        <div className="loading">Loading products...</div>
      ) : (
        <>
          <div className="products-grid">
            {currentProducts.length === 0 ? (
              <p>No products found.</p>
            ) : (
              currentProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={currentPage === i + 1 ? 'active' : ''}>
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductsPage;
