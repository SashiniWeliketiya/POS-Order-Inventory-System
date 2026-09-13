import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://pos-backend-api-delta.vercel.app';

function CountdownTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(expiresAt) - new Date();
      if (difference <= 0) {
        setTimeLeft('00:00');
        setIsExpired(true);
        return;
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setTimeLeft(formatted);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <span style={{ color: isExpired ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
      {timeLeft} {isExpired ? '(Expired)' : ''}
    </span>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`);
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders`);
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    const interval = setInterval(() => {
      fetchProducts();
      fetchOrders();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();

    if (!newProduct.name || newProduct.price === '' || newProduct.stock === '') {
      alert('Please fill in all product details correctly.');
      return;
    }

    const payload = {
      name: newProduct.name.trim(),
      price: Number(newProduct.price),
      stock: Number(newProduct.stock)
    };

    if (isNaN(payload.price) || isNaN(payload.stock)) {
      alert('Price and Stock must be valid numbers!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setNewProduct({ name: '', price: '', stock: '' });
        fetchProducts();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Failed to add product:', err);
      alert('Failed to connect to backend server!');
    }
  };

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.productId === product._id);
      if (existing) {
        return prevCart.map((i) =>
          i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevCart, { productId: product._id, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;

    try {
      const reservedOrders = [];

      for (const item of cart) {
        const res = await fetch(`${API_BASE_URL}/api/orders/reserve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            productId: item.productId, 
            quantity: Number(item.quantity) 
          }),
        });

        const data = await res.json();

        if (res.ok) {
          reservedOrders.push(data.order);
        } else {
          alert(`Failed for ${item.name}: ${data.error}`);
        }
      }

      if (reservedOrders.length > 0) {
        setActiveOrders(reservedOrders);
        setCart([]);
        fetchProducts();
        fetchOrders();
      }
    } catch (err) {
      alert('Failed to reserve stock.');
    }
  };

  // Payment Success simulation
  const handleMockPaymentSuccess = async () => {
    if (activeOrders.length === 0) return;

    try {
      for (const order of activeOrders) {
        await fetch(`${API_BASE_URL}/api/orders/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order._id }),
        });
      }

      alert('Payment successful, orders completed!');
      setActiveOrders([]);
      fetchProducts();
      fetchOrders();
    } catch (err) {
      alert('Payment processing error.');
    }
  };

  // Payment Failure simulation (Cancels order & restores stock)
  const handleMockPaymentFailure = async () => {
    if (activeOrders.length === 0) return;

    try {
      for (const order of activeOrders) {
        await fetch(`${API_BASE_URL}/api/orders/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order._id }),
        });
      }

      alert('Payment failed! Reserved stock has been released back to inventory.');
      setActiveOrders([]);
      fetchProducts();
      fetchOrders();
    } catch (err) {
      alert('Error cancelling order on failure.');
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      alert(data.message || 'Action executed.');
      fetchProducts();
      fetchOrders();
    } catch (err) {
      alert('Failed to cancel order.');
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>POS Order & Inventory System</h1>
        <p className="subtitle">Concurrency-Safe Stock Reservation & Mock Payments</p>
      </header>

      {/* Add Product Section */}
      <section className="card add-product-card">
        <h3>Add New Product to Inventory</h3>
        <form onSubmit={handleAddProduct} className="form-row">
          <input 
            type="text" 
            placeholder="Product Name" 
            value={newProduct.name} 
            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} 
            required 
          />
          <input 
            type="number" 
            placeholder="Price (LKR)" 
            value={newProduct.price} 
            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} 
            required 
            min="1"
          />
          <input 
            type="number" 
            placeholder="Stock Quantity" 
            value={newProduct.stock} 
            onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} 
            required 
            min="1"
          />
          <button type="submit" className="btn btn-primary">+ Add Item</button>
        </form>
      </section>

      <div className="main-content">
        {/* Available Products */}
        <section className="products-section">
          <h2>Live Inventory Products</h2>
          <div className="product-grid">
            {products.map((p) => (
              <div key={p._id} className="product-card">
                <h4>{p.name}</h4>
                <p>Price: <strong>LKR {p.price}</strong></p>
                <p className="stock-info">
                  Available Stock: <span className={p.stock > 0 ? 'text-success' : 'text-danger'}>{p.stock}</span>
                </p>
                <button 
                  className={`btn ${p.stock > 0 ? 'btn-action' : 'btn-disabled'}`} 
                  disabled={p.stock <= 0} 
                  onClick={() => addToCart(p)}
                >
                  {p.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Current Cart & Mock Payment Panel */}
        <aside className="card cart-section">
          <h3>Current Cart</h3>
          {cart.length === 0 ? <p className="empty-cart">Cart is empty</p> : (
            <div>
              {cart.map((item) => (
                <div key={item.productId} className="cart-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span>{item.name} × {item.quantity}</span>
                    <br />
                    <small>LKR {item.price * item.quantity}</small>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.productId)}
                    style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={handleCreateOrder}>
                Reserve Stock & Checkout
              </button>
            </div>
          )}

          {activeOrders.length > 0 && (
            <div style={{ marginTop: '20px', padding: '12px', background: '#e9ecef', borderRadius: '6px' }}>
              <h4>Mock Payment Gateway</h4>
              <p><small>Active Reserved Items: {activeOrders.length}</small></p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <button className="btn btn-success" onClick={handleMockPaymentSuccess}>
                  Simulate Payment Success
                </button>
                <button className="btn" style={{ background: '#dc3545', color: '#fff' }} onClick={handleMockPaymentFailure}>
                  Simulate Payment Failure
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Order Lifecycle Table */}
      <section className="card" style={{ marginTop: '30px' }}>
        <h3>Order Audit History & Lifecycle Log</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#f1f1f1', textAlign: 'left' }}>
              <th>Order ID</th>
              <th>Quantity</th>
              <th>Status</th>
              <th>Time Remaining</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id} style={{ borderBottom: '1px solid #ddd' }}>
                <td>{o._id}</td>
                <td>{o.quantity}</td>
                <td><strong>{o.status}</strong></td>
                <td>
                  {['RESERVED', 'Reserved'].includes(o.status) ? (
                    <CountdownTimer expiresAt={new Date(new Date(o.createdAt).getTime() + 5 * 60000)} />
                  ) : (
                    'N/A'
                  )}
                </td>
                <td>
                  {['RESERVED', 'Reserved'].includes(o.status) && (
                    <button className="btn btn-disabled" style={{ background: '#dc3545', color: '#fff', padding: '4px 8px' }} onClick={() => handleCancelOrder(o._id)}>
                      Cancel Order
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default App;