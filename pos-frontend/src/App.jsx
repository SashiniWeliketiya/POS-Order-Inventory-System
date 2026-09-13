import React, { useState, useEffect } from 'react';
import './App.css';

// Live Countdown Timer Component
function CountdownTimer({ reservedUntil }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(reservedUntil) - new Date();
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
  }, [reservedUntil]);

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
  const [activeOrder, setActiveOrder] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });

  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    const interval = setInterval(() => {
      fetchProducts();
      fetchOrders();
    }, 2000); // 2-second polling for real-time status update
    return () => clearInterval(interval);
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    await fetch('http://localhost:5000/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newProduct.name,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
      }),
    });
    setNewProduct({ name: '', price: '', stock: '' });
    fetchProducts();
  };

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.productId === product._id);
      if (existing) {
        return prevCart.map((i) =>
          i.productId === product._id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prevCart, { productId: product._id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    const res = await fetch('http://localhost:5000/api/orders/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart }),
    });

    const data = await res.json();
    if (res.ok) {
      setActiveOrder(data.order);
      setCart([]);
      fetchProducts();
      fetchOrders();
    } else {
      alert(data.error);
    }
  };

  const handleMockPayment = async (outcome) => {
    if (!activeOrder) return;
    const res = await fetch('http://localhost:5000/api/orders/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: activeOrder._id,
        outcome,
        idempotencyKey: `PAY-${activeOrder._id}-${Date.now()}`
      }),
    });

    const data = await res.json();
    alert(data.message);
    setActiveOrder(null);
    fetchProducts();
    fetchOrders();
  };

  const handleCancelOrder = async (orderId) => {
    const res = await fetch('http://localhost:5000/api/orders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    alert(data.message);
    fetchProducts();
    fetchOrders();
  };

  return (
    <div className="container">
      <header className="header">
        <h1>POS Order & Inventory System</h1>
        <p className="subtitle">Concurrency-Safe Stock Reservation & Mock Payments</p>
      </header>

      {/* Add Product Section */}
      <section className="card add-product-card">
        <h3>Add New Product</h3>
        <form onSubmit={handleAddProduct} className="form-row">
          <input type="text" placeholder="Product Name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />
          <input type="number" placeholder="Price (LKR)" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
          <input type="number" placeholder="Stock" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} required />
          <button type="submit" className="btn btn-primary">Add Product</button>
        </form>
      </section>

      <div className="main-content">
        {/* Available Products */}
        <section className="products-section">
          <h2>Available Products</h2>
          <div className="product-grid">
            {products.map((p) => (
              <div key={p._id} className="product-card">
                <h4>{p.name}</h4>
                <p>Price: <strong>LKR {p.price}</strong></p>
                <p className="stock-info">Stock: <span className={p.stock > 0 ? 'text-success' : 'text-danger'}>{p.stock} Available</span></p>
                <button className={`btn ${p.stock > 0 ? 'btn-action' : 'btn-disabled'}`} disabled={p.stock <= 0} onClick={() => addToCart(p)}>
                  Add to Cart
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
                <div key={item.productId} className="cart-item">
                  <span>{item.name} (x{item.qty})</span>
                  <span>LKR {item.price * item.qty}</span>
                </div>
              ))}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={handleCreateOrder}>
                Proceed to Checkout (Reserve Stock)
              </button>
            </div>
          )}

          {activeOrder && (
            <div style={{ marginTop: '20px', padding: '10px', background: '#e9ecef', borderRadius: '5px' }}>
              <h4>Mock Payment Gateway</h4>
              <p><small>Order ID: {activeOrder._id}</small></p>
              <p><strong>Total: LKR {activeOrder.totalAmount}</strong></p>
              <p style={{ marginTop: '5px' }}>
                Time Remaining: <CountdownTimer reservedUntil={activeOrder.reservedUntil} />
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' }}>
                <button className="btn btn-success" onClick={() => handleMockPayment('success')}>Simulate Payment Success</button>
                <button className="btn btn-disabled" style={{ background: '#dc3545', color: '#fff' }} onClick={() => handleMockPayment('failure')}>Simulate Payment Failure</button>
                <button className="btn btn-disabled" style={{ background: '#ffc107', color: '#000' }} onClick={() => handleMockPayment('timeout')}>Simulate Payment Timeout</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Order Lifecycle Table with Live Countdown */}
      <section className="card" style={{ marginTop: '30px' }}>
        <h3>Order Lifecycle Management</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#f1f1f1', textAlign: 'left' }}>
              <th>Order ID</th>
              <th>Total</th>
              <th>Status</th>
              <th>Time Remaining</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id} style={{ borderBottom: '1px solid #ddd' }}>
                <td>{o._id}</td>
                <td>LKR {o.totalAmount}</td>
                <td><strong>{o.status}</strong></td>
                <td>
                  {o.status === 'Reserved' ? (
                    <CountdownTimer reservedUntil={o.reservedUntil} />
                  ) : (
                    'N/A'
                  )}
                </td>
                <td>
                  {['Reserved', 'Paid'].includes(o.status) && (
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