import React, { useEffect, useState, useRef } from 'react';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, onSnapshot, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Loader2, ArrowLeft, Package, History, Search, Home, ShoppingCart, MapPin, CreditCard, CheckCircle, AlertCircle, LogOut, Share2, X } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';

declare const Cashfree: any;

type ViewState = 'PRODUCTS' | 'PRODUCT_DETAILS' | 'ADDRESS' | 'SUMMARY' | 'STATUS' | 'ORDERS' | 'ORDER_DETAIL' | 'CART' | 'LOGIN';

const OrderCard = ({ order, isDetail, onClick }: any) => {
  return (
    <div 
       onClick={onClick}
       className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5 ${!isDetail ? 'cursor-pointer hover:border-blue-400 transition-colors' : ''}`}
     >
       <div className="flex justify-between items-start border-b border-gray-100 pb-4">
         <div>
           <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Order ID</p>
           <p className="font-mono text-sm font-medium text-gray-900">{order.orderId}</p>
         </div>
         <div className="text-right">
           <div className="text-lg font-bold text-gray-900">₹{order.amount}</div>
           {order.status === 'PENDING' && <div className="text-green-600 font-bold bg-green-100 px-2 rounded text-[10px] uppercase py-0.5 inline-block mt-1">Paid</div>}
           {order.status === 'COMPLETED' && <div className="text-green-700 font-bold bg-green-100 px-2 rounded text-[10px] uppercase py-0.5 inline-block mt-1">Complete</div>}
           {order.status === 'CANCELLED' && <div className="text-red-700 font-bold bg-red-100 px-2 rounded text-[10px] uppercase py-0.5 inline-block mt-1">Cancelled</div>}
         </div>
       </div>

       <div className="flex gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
         <img src={order.product?.images?.[0] || order.product?.image} alt="Product" className="w-16 h-16 rounded-lg object-cover bg-gray-200" />
         <div className="flex-1">
           <h3 className="font-semibold text-gray-900 line-clamp-1">{order.product?.title || order.product?.name}</h3>
           <p className="text-sm text-gray-500 mt-1">Qty: 1</p>
         </div>
       </div>

       <div className="space-y-3 border-t border-gray-100 pt-4">
         <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Info</h3>
         <div className="text-sm text-gray-800">
           <p className="font-semibold">{order.address?.name} <span className="text-gray-400 font-normal ml-2">{order.address?.phone}</span></p>
           <p className="mt-1 text-gray-600 line-clamp-2">{order.address?.addressLine}, {order.address?.pincode}</p>
         </div>
       </div>

       <div className="space-y-3 border-t border-gray-100 pt-4">
         <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order Progress</h3>
         
         {order.status === 'COMPLETED' ? (
            <div className="flex items-center gap-3 bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 transition-all">
              <CheckCircle className="w-6 h-6" />
              <span className="font-bold text-lg">Order Complete</span>
            </div>
         ) : order.status === 'CANCELLED' ? (
            <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 transition-all">
              <AlertCircle className="w-6 h-6" />
              <span className="font-bold text-lg">Order Cancelled</span>
            </div>
         ) : (
            <div className="bg-white p-4 rounded-xl border border-gray-100 space-y-3 shadow-sm transition-all">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500">Ordered: <span className="font-semibold text-gray-900">
                  {order.createdAt ? new Date(order.createdAt?.toMillis ? order.createdAt.toMillis() : (order.createdAt?.seconds * 1000 || Date.now())).toLocaleDateString() : 'N/A'}
                </span></span>
                <span className="text-gray-500">Expected: <span className="font-semibold text-gray-900">
                  {order.createdAt ? (() => {
                    const d = new Date(order.createdAt?.toMillis ? order.createdAt.toMillis() : (order.createdAt?.seconds * 1000 || Date.now()));
                    d.setDate(d.getDate() + 7);
                    return d.toLocaleDateString();
                  })() : 'N/A'}
                </span></span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-in-out" 
                  style={{ 
                    width: `${order.createdAt ? Math.min(100, Math.max(10, (Math.floor((new Date().getTime() - (order.createdAt?.toMillis ? order.createdAt.toMillis() : (order.createdAt?.seconds * 1000 || Date.now()))) / (1000 * 3600 * 24)) / 7) * 100)) : 10}%` 
                  }} 
                />
              </div>
              <p className="text-xs text-center text-gray-500 font-medium">
                {order.createdAt ? (() => {
                  const diff = Math.floor((new Date().getTime() - (order.createdAt?.toMillis ? order.createdAt.toMillis() : (order.createdAt?.seconds * 1000 || Date.now()))) / (1000 * 3600 * 24));
                  if (diff <= 0) return 'Ordered today';
                  if (diff >= 7) return 'Arriving soon';
                  return `${diff} days since order placed`;
                })() : ''}
              </p>
            </div>
         )}
       </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewState>('PRODUCTS');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [address, setAddress] = useState({ name: '', phone: '', addressLine: '', pincode: '' });
  
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  const [categories, setCategories] = useState<any[]>([]);

  const relatedProducts = selectedProduct ? products.filter((p: any) => p.categoryId === selectedProduct.categoryId && p.id !== selectedProduct.id).slice(0, 8) : [];
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [paying, setPaying] = useState(false);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderData, setOrderData] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const isCartLoaded = useRef(false);
  const [cart, setCart] = useState<any[]>(() => { try { const saved = localStorage.getItem('cart'); return saved ? JSON.parse(saved) : []; } catch(e) { return []; } });

  useEffect(() => { 
    localStorage.setItem('cart', JSON.stringify(cart)); 
    if (user && isCartLoaded.current) {
        setDoc(doc(db, 'carts', user.uid), { items: cart }).catch(console.error);
    }
  }, [cart, user]);

  // Sync cart and selectedProduct with the latest products data
  useEffect(() => {
    if (products.length > 0) {
      setCart(currentCart => {
        let changed = false;
        const newCart = currentCart.map(cartItem => {
          const liveProduct = products.find(p => p.id === cartItem.id);
          if (!liveProduct) return cartItem;
          
          const isDifferent = 
            liveProduct.price !== cartItem.price ||
            liveProduct.title !== cartItem.title ||
            liveProduct.originalPrice !== cartItem.originalPrice ||
            liveProduct.discount !== cartItem.discount ||
            liveProduct.image !== cartItem.image ||
            JSON.stringify(liveProduct.images) !== JSON.stringify(cartItem.images);
            
          if (isDifferent) {
            changed = true;
            return { ...cartItem, ...liveProduct };
          }
          return cartItem;
        });
        return changed ? newCart : currentCart;
      });

      setSelectedProduct(prev => {
        if (!prev) return prev;
        const liveProduct = products.find(p => p.id === prev.id);
        if (!liveProduct) return prev;
        
        const isDifferent = 
          liveProduct.price !== prev.price ||
          liveProduct.title !== prev.title ||
          liveProduct.originalPrice !== prev.originalPrice ||
          liveProduct.discount !== prev.discount ||
          liveProduct.image !== prev.image ||
          JSON.stringify(liveProduct.images) !== JSON.stringify(prev.images);
          
        if (isDifferent) {
          return { ...prev, ...liveProduct };
        }
        return prev;
      });
    }
  }, [products]);

  useEffect(() => {
    const currentView = window.history.state?.view || 'PRODUCTS';
    if (currentView !== view) {
      if (view !== 'PRODUCTS') {
        window.history.pushState({ view }, '', `#${view}`);
      } else {
        window.history.pushState({ view: 'PRODUCTS' }, '', window.location.pathname);
      }
    }
  }, [view]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        setView(e.state.view);
      } else {
        setView('PRODUCTS');
      }
    };
    window.addEventListener('popstate', handlePopState);
    // Set initial state
    if (!window.history.state) {
       window.history.replaceState({ view: 'PRODUCTS' }, '', window.location.pathname);
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goBackToProducts = () => {
    setView('PRODUCTS');
    setSelectedProduct(null);
    window.scrollTo(0, 0);
  };

  const goBackToProductDetails = () => {
    setView('PRODUCT_DETAILS');
    window.scrollTo(0, 0);
  };

  const goBackToAddress = () => {
    setView('ADDRESS');
    window.scrollTo(0, 0);
  };

  const goBackToOrders = () => {
    setView('ORDERS');
    window.scrollTo(0, 0);
  };

  const hasAutoChecked = useRef(false);

  const [pendingAction, setPendingAction] = useState<ViewState | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setOrdersList([]);
        setOrderData(null);
        setSelectedOrder(null);
        setCart([]);
        isCartLoaded.current = false;
      } else {
        try {
          const cartDoc = await getDoc(doc(db, 'carts', u.uid));
          if (cartDoc.exists()) {
             const remoteCart = cartDoc.data().items || [];
             setCart(remoteCart);
          }
        } catch (e) {
          console.error('Failed to load cart', e);
        }
        isCartLoaded.current = true;
      }
      
      if (u && view === 'LOGIN') {
        if (pendingAction) {
           setView(pendingAction);
           setPendingAction(null);
           if (pendingAction === 'ORDERS') {
              fetchOrders();
           }
        } else {
           setView('PRODUCTS');
        }
      }
    });
    return unsub;
  }, [view, pendingAction]);

  useEffect(() => {
    fetchCategories();
    
    // Check URL for product
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');

    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      let finalProducts = [];
      if (fetched.length > 0) {
        finalProducts = fetched;
        setProducts(fetched);
      } else {
        finalProducts = [
          { id: '1', title: 'Classic White T-Shirt', price: 499, originalPrice: 999, discount: 500, categoryId: 'cat1', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400' },
          { id: '2', title: 'Premium Running Shoes', price: 1499, originalPrice: 2499, discount: 1000, categoryId: 'cat2', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400' },
          { id: '3', title: 'Luxury Gold Watch', price: 2999, originalPrice: 5999, discount: 3000, categoryId: 'cat3', image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&q=80&w=400' },
          { id: '4', title: 'Denim Blue Jeans', price: 899, originalPrice: 1499, discount: 600, categoryId: 'cat4', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=400' },
          { id: '5', title: 'Leather Biker Jacket', price: 3499, originalPrice: 5999, discount: 2500, categoryId: 'cat5', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=400' },
          { id: '6', title: 'Classic Aviator Sunglasses', price: 599, originalPrice: 999, discount: 400, categoryId: 'cat6', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=400' }
        ];
        setProducts(finalProducts);
      }
      setLoadingProducts(false);
      
      if (productId && !hasAutoChecked.current) {
         const p = finalProducts.find(p => p.id === productId);
         if (p) {
            setSelectedProduct(p);
            setView('PRODUCT_DETAILS');
         }
         hasAutoChecked.current = true;
      }
    }, (err: any) => {
      if(err?.message !== "Network Error") console.error(err);
      setLoadingProducts(false);
    });

    return () => unsub();
  }, []);

  const fetchCategories = async () => {
    try {
      const q = query(collection(db, 'categories'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (fetched.length > 0) {
        setCategories(fetched);
      } else {
        setCategories([
          { id: 'cat1', name: 'T-Shirts', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=200&h=200' },
          { id: 'cat2', name: 'Shoes', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=200&h=200' },
          { id: 'cat3', name: 'Watches', image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&q=80&w=200&h=200' },
          { id: 'cat4', name: 'Jeans', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=200&h=200' },
          { id: 'cat5', name: 'Jackets', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=200&h=200' },
          { id: 'cat6', name: 'Sunglasses', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=200&h=200' },
          { id: 'cat7', name: 'Backpacks', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=200&h=200' },
          { id: 'cat8', name: 'Hats', image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&q=80&w=200&h=200' },
        ]);
      }
    } catch(err: any) {
      if(err?.message !== "Network Error") console.error(err);
    }
  };

  useEffect(() => {
    if (user && !hasAutoChecked.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const orderId = urlParams.get('order_id');
      if (orderId) {
        hasAutoChecked.current = true;
        setOrderQuery(orderId);
        setView('STATUS');
        handleCheckOrder(orderId);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedOrders.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      setOrdersList(fetchedOrders);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (!err.message?.includes('cancelled-popup-request')) {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setActiveImageIndex(0);
    setView('PRODUCT_DETAILS');
    window.scrollTo(0, 0);
  };

  const handleNextToAddress = () => {
    if (!user) {
      setPendingAction('ADDRESS');
      setView('LOGIN');
      return;
    }
    setView('ADDRESS');
    window.scrollTo(0, 0);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?product=${selectedProduct.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedProduct.title,
          url: url
        });
      } catch (err) {
        console.log('Share dismissed', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      } catch (err) {}
    }
  };

  const handleNextToSummary = () => {
    if (!address.name || !address.phone || !address.addressLine || !address.pincode) {
      setError("Please fill all address fields.");
      return;
    }
    setError(null);
    setView('SUMMARY');
    window.scrollTo(0, 0);
  };

  const initiatePayment = async () => {
    if (!user || !selectedProduct) return;
    setPaying(true);
    setError(null);

    try {
      const response = await axios.post('/api/create-order', {
        amount: selectedProduct.price,
        customerId: user.uid,
        customerEmail: user.email,
        customerPhone: address.phone,
        returnUrl: `${window.location.origin}/?order_id={order_id}`
      });

      const data = response.data;

      if (!data.payment_session_id) {
        throw new Error(data.error?.message || data.error || 'Failed to generate payment session.');
      }

      await setDoc(doc(db, 'orders', data.order_id), {
        orderId: data.order_id,
        userId: user.uid,
        amount: selectedProduct.price,
        status: 'DRAFT',
        product: selectedProduct,
        address: address,
        createdAt: serverTimestamp(),
      });

      const cashfree = await new Promise<any>(async (resolve) => {
        if (typeof Cashfree !== 'undefined') {
          const configRes = await axios.get('/api/config');
          const mode = configRes.data.env.toLowerCase() === 'production' ? 'production' : 'sandbox';
          resolve(Cashfree({ mode }));
        } else {
          setError("Cashfree SDK not loaded. Check internet connection.");
          setPaying(false);
        }
      });

      let checkoutOptions = {
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self", 
      };

      cashfree.checkout(checkoutOptions).then((result: any) => {
        if(result.error){
          console.error("Payment failed", result.error);
          setError(result.error.message);
          setPaying(false);
        }
      });

    } catch (err: any) {
      if(err?.message !== "Network Error") console.error(err);
      const errMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Payment initialization failed';
      setError(errMsg);
      setPaying(false);
    }
  };

  const handleCheckOrder = async (queryId?: string) => {
    const oid = (queryId || orderQuery).trim();
    if (!oid) return;
    
    setChecking(true);
    setError(null);
    setOrderData(null);
    
    try {
      const res = await axios.get(`/api/check-order/${oid}`);
      const data = res.data;
      setOrderData(data);

      if (data.order?.order_status === 'PAID' || data.order?.order_status === 'SUCCESS') {
        try {
          const orderRef = doc(db, 'orders', oid);
          const orderDocData = await getDoc(orderRef);
          
          if (orderDocData.exists()) {
             if (orderDocData.data().status === 'DRAFT') {
                 await updateDoc(orderRef, {
                    status: 'PENDING',
                    paidAt: serverTimestamp()
                 });
             }
          }
        } catch (dbErr) {
          console.error("Database claim error", dbErr);
        }
      }

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch order information.');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col overflow-x-hidden w-full">
      <header className="bg-white sticky top-0 z-50 px-4 py-4 border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center w-full">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('PRODUCTS')}>
            <Package className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900">NextGen Shop</h1>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:block text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
                Welcome, <span className="font-bold">{user.displayName?.split(' ')[0] || 'User'}</span>
              </div>
            )}
            <button 
              onClick={() => {
                if (!user) {
                  setPendingAction('ORDERS');
                  setView('LOGIN');
                  return;
                }
                setView('ORDERS');
                fetchOrders();
              }}
              className="p-2 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">My Orders</span>
            </button>
            {user ? (
              <button 
                onClick={async () => {
                  try {
                    await logout();
                    setView('PRODUCTS');
                    setSelectedProduct(null);
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg transition-colors group flex items-center gap-2 text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <button 
                onClick={() => setView('LOGIN')}
                className="p-2 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-lg transition-colors group flex items-center gap-2 text-sm font-medium"
              >
                <span className="font-bold">Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

       <main className="flex-1 max-w-4xl mx-auto w-full pb-8 md:pb-8">
        
        {view === 'PRODUCTS' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
            {/* Search Bar */}
            <div className="px-4 md:px-0 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search for t-shirts, shoes, etc..." 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                />
              </div>
            </div>

            {/* Sticky Category Bar */}
            {!searchQuery && (
              <div className="sticky top-[73px] z-40 bg-white border-b border-gray-200 shadow-sm px-4 py-3 -mx-4 md:mx-0 overflow-x-auto hide-scrollbar whitespace-nowrap mb-6">
                 <div className="flex gap-4 items-center">
                    <button 
                      onClick={() => setActiveCategory('ALL')} 
                      className="flex flex-col items-center gap-1 group min-w-[60px]"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${activeCategory === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'}`}>
                        <span className="font-bold text-xs uppercase">ALL</span>
                      </div>
                      <span className={`text-[10px] font-bold ${activeCategory === 'ALL' ? 'text-blue-600' : 'text-gray-600'}`}>All Items</span>
                    </button>
                    {categories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)} 
                        className="flex flex-col items-center gap-1 group min-w-[60px]"
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors overflow-hidden border-2 ${activeCategory === cat.id ? 'border-blue-600' : 'border-transparent bg-gray-100 group-hover:bg-gray-200'}`}>
                          {cat.image ? (
                            <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-xs text-gray-600 uppercase">{cat.name.substring(0, 3)}</span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold ${activeCategory === cat.id ? 'text-blue-600' : 'text-gray-600'}`}>{cat.name}</span>
                      </button>
                    ))}
                 </div>
              </div>
            )}

            <div className="px-4 md:px-8 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 line-clamp-1">{searchQuery ? 'Search Results' : (activeCategory === 'ALL' ? 'Flash Sale - Everything ₹10!' : categories.find(c => c.id === activeCategory)?.name)}</h2>
              {loadingProducts ? (
                 <div className="py-12 flex justify-center">
                   <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                 </div>
              ) : products.filter(p => searchQuery ? (p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.name?.toLowerCase().includes(searchQuery.toLowerCase())) : (activeCategory === 'ALL' || p.categoryId === activeCategory)).length === 0 ? (
                 <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm text-gray-500">
                   No products found.
                 </div>
              ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {products.filter(p => searchQuery ? (p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.name?.toLowerCase().includes(searchQuery.toLowerCase())) : (activeCategory === 'ALL' || p.categoryId === activeCategory)).map(product => (
                  <div key={product.id} onClick={() => handleProductClick(product)} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer flex flex-col">
                    <div className="aspect-[4/5] overflow-hidden relative bg-gray-50 p-2">
                      <img src={product.images?.[0] || product.image} alt={product.title || product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply" />
                      {product.discount > 0 && (
                         <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                           {Math.round((product.discount / product.originalPrice) * 100)}% OFF
                         </div>
                      )}
                    </div>
                    <div className="p-3 md:p-4 space-y-3 flex-1 flex flex-col border-t border-gray-100">
                      <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2 md:text-lg">{product.title || product.name}</h3>
                      <div className="flex flex-col md:flex-row md:items-end gap-1 md:gap-2 pt-2 mt-auto">
                        <span className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">₹{product.price}</span>
                        {product.originalPrice > product.price && (
                           <span className="text-xs text-gray-400 line-through md:mb-1">₹{product.originalPrice}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>

            {/* Footer */}
            <footer className="mt-16 bg-white border-t border-gray-200 py-8 px-4 text-center">
              <div className="max-w-4xl mx-auto space-y-2">
                <h3 className="text-lg font-bold text-gray-900">Contact Us</h3>
                <p className="text-gray-600 text-sm">Email: <a href="mailto:abhisheksaw13@gmail.com" className="text-blue-600 hover:underline">abhisheksaw13@gmail.com</a></p>
                <p className="text-gray-600 text-sm">Mobile: <a href="tel:7870674256" className="text-blue-600 hover:underline">7870674256</a></p>
                <div className="pt-4 mt-4 border-t border-gray-100 flex justify-center gap-4 text-xs text-gray-400">
                  <a href="#" className="hover:text-gray-600">Privacy Policy</a>
                  <a href="#" className="hover:text-gray-600">Terms of Service</a>
                  <a href="#" className="hover:text-gray-600">Refund Policy</a>
                </div>
                <p className="text-xs text-gray-400 pt-4">© 2026 Your Store Name. All rights reserved.</p>
              </div>
            </footer>
          </motion.div>
        )}

        {view === 'LOGIN' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center pt-8 md:pt-16 px-4">
            <button 
              onClick={() => {
                if (pendingAction === 'ADDRESS') {
                  setView('PRODUCT_DETAILS');
                } else if (pendingAction === 'PRODUCT_DETAILS') {
                  setView('PRODUCT_DETAILS');
                } else {
                  setView('PRODUCTS');
                }
                setPendingAction(null);
              }}
              className="mb-6 text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium self-start sm:self-auto sm:-ml-48"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                  <ShoppingCart className="w-8 h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Sign in to continue</h2>
                <p className="text-gray-500 text-sm">Please log in to proceed with your shopping.</p>
              </div>

              {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg text-center">{error}</div>}

              <button 
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm flex justify-center items-center gap-3 disabled:opacity-50"
              >
                {authLoading ? <Loader2 className="animate-spin w-5 h-5 text-gray-400" /> : (
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google"/>
                )}
                Continue with Google
              </button>
            </div>
          </motion.div>
        )}

        {view === 'PRODUCT_DETAILS' && selectedProduct && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 pb-24">
            <button onClick={goBackToProducts} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium pt-2 px-2">
              <ArrowLeft className="w-4 h-4" /> Back to Store
            </button>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col md:flex-row">
              <div className="w-full md:w-1/2 p-6 flex flex-col gap-4 bg-white relative">
                <button 
                  onClick={handleShare}
                  className="absolute top-8 right-8 p-3 bg-white/90 backdrop-blur-sm rounded-full text-gray-700 hover:text-blue-600 shadow-md transition-all hover:scale-105 z-10"
                  aria-label="Share product"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <div className="aspect-[4/5] sm:aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                  <img src={selectedProduct.images?.[activeImageIndex] || selectedProduct.image} alt="Product" className="w-full h-full object-contain max-h-[60vh] max-w-[90%]" />
                </div>
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                   <div className="flex gap-2 flex-wrap justify-center mt-2">
                      {selectedProduct.images.map((img: string, i: number) => (
                         <div key={i} onClick={() => setActiveImageIndex(i)} className={`w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${activeImageIndex === i ? 'border-blue-600' : 'border-gray-200'}`}>
                           <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                         </div>
                      ))}
                   </div>
                )}
              </div>
              <div className="w-full md:w-1/2 p-6 flex flex-col border-t md:border-t-0 md:border-l border-gray-100 bg-gray-50/30">
                <h1 className="text-2xl pt-2 sm:text-3xl font-bold text-gray-900 leading-tight mb-2">{selectedProduct.title || selectedProduct.name}</h1>
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    4.5 ★
                  </span>
                  <span className="text-gray-500 font-medium text-sm">24 Ratings</span>
                </div>
                
                <div className="mt-2 bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1">
                  <span className="text-green-600 font-bold text-sm tracking-wide uppercase">Special Price</span>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-bold text-gray-900 tracking-tight">₹{selectedProduct.price}</span>
                    {selectedProduct.originalPrice > selectedProduct.price && (
                       <>
                         <span className="text-lg text-gray-400 line-through mb-1">₹{selectedProduct.originalPrice}</span>
                         <span className="text-green-600 font-bold text-lg mb-1">
                           {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% off
                         </span>
                       </>
                    )}
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">Product Details</h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    <div className="flex">
                      <span className="w-32 text-gray-500 font-medium">Category</span>
                      <span className="font-semibold">{categories.find(c => c.id === selectedProduct.categoryId)?.name || 'General Fashion'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-gray-500 font-medium">Payment</span>
                      <span className="font-semibold text-green-700">All payment methods available</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-gray-500 font-medium">Returns</span>
                      <span className="font-semibold">10 Days Return Policy</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {relatedProducts.length > 0 && (
               <div className="mt-8 space-y-4 px-2">
                 <h2 className="text-xl font-bold text-gray-900">Similar Products</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {relatedProducts.map(product => (
                      <div key={product.id} onClick={() => handleProductClick(product)} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer flex flex-col">
                        <div className="aspect-[4/5] overflow-hidden relative bg-gray-50 p-2">
                          <img src={product.images?.[0] || product.image} alt={product.title || product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply" />
                        </div>
                        <div className="p-3 space-y-1 flex-1 flex flex-col justify-between border-t border-gray-100">
                          <h3 className="font-medium text-sm text-gray-700 leading-tight line-clamp-2 hover:text-blue-600">{product.title || product.name}</h3>
                          <div className="flex flex-col pt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-900 tracking-tight">₹{product.price}</span>
                              {product.originalPrice > product.price && (
                                <span className="text-green-600 text-xs font-bold">{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% off</span>
                              )}
                            </div>
                            {product.originalPrice > product.price && (
                              <span className="text-xs text-gray-400 line-through">₹{product.originalPrice}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
            )}
            
            {/* Fixed Bottom Toolbar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50 flex flex-col justify-center items-center shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:pb-3 pb-safe">
              {user && (
                  <div className="w-full max-w-6xl px-2 mb-2">
                    <p className="text-sm text-gray-600 font-medium text-center">Welcome, <span className="font-bold">{user.displayName?.split(' ')[0] || user.email}</span></p>
                  </div>
              )}
              <div className="flex gap-3 w-full max-w-6xl px-2">
                  <button 
                    onClick={() => {
                      if (!user) {
                        setPendingAction('PRODUCT_DETAILS'); // basically stay there but ask for login
                        setView('LOGIN');
                        return;
                      }
                      if (cart.some(item => item.id === selectedProduct.id)) {
                        setCart(cart.filter(item => item.id !== selectedProduct.id));
                      } else {
                        setCart([...cart, selectedProduct]);
                        alert('Added to Cart!');
                      }
                    }} 
                    className={`flex-1 h-[50px] border-2 font-bold rounded-xl transition-colors flex items-center justify-center ${cart.some(item => item.id === selectedProduct.id) ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'}`}
                  >
                    {cart.some(item => item.id === selectedProduct.id) ? 'Remove Cart' : 'Add to Cart'}
                  </button>
                  <button onClick={handleNextToAddress} className="flex-1 h-[50px] bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-lg transition-colors shadow-sm tracking-wide flex items-center justify-center">
                    Buy Now
                  </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'ADDRESS' && selectedProduct && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto space-y-6">
            <button onClick={goBackToProductDetails} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Product
            </button>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="bg-blue-50 p-2 rounded-lg"><MapPin className="text-blue-600 w-5 h-5" /></div>
                <h2 className="text-xl font-bold flex-1">Delivery Address</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</label>
                    <input type="text" value={address.name} onChange={e => setAddress({...address, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:bg-white focus:border-blue-500 outline-none transition-colors" placeholder="John Doe" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</label>
                    <input type="text" value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:bg-white focus:border-blue-500 outline-none transition-colors" placeholder="9876543210" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Address</label>
                  <textarea value={address.addressLine} onChange={e => setAddress({...address, addressLine: e.target.value})} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:bg-white focus:border-blue-500 outline-none transition-colors" placeholder="123 Street Name, City, State" />
                </div>
                <div className="space-y-1 w-1/2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">PIN Code</label>
                  <input type="text" value={address.pincode} onChange={e => setAddress({...address, pincode: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:bg-white focus:border-blue-500 outline-none transition-colors" placeholder="110001" />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

              <button 
                onClick={handleNextToSummary}
                className="w-full h-[50px] bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors mt-4 shadow-sm flex items-center justify-center"
              >
                Proceed to Order Summary
              </button>
            </div>
          </motion.div>
        )}

        {view === 'SUMMARY' && selectedProduct && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto space-y-6">
             <button onClick={goBackToAddress} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Address
            </button>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="bg-blue-50 p-2 rounded-lg"><CreditCard className="text-blue-600 w-5 h-5" /></div>
                <h2 className="text-xl font-bold flex-1">Order Summary</h2>
              </div>
              
              <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <img src={selectedProduct.images?.[0] || selectedProduct.image} alt="Product" className="w-20 h-20 rounded-lg object-cover" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{selectedProduct.title || selectedProduct.name}</h3>
                  <p className="text-sm text-gray-500">Qty: 1</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-bold text-gray-900">₹{selectedProduct.price}</span>
                    {selectedProduct.originalPrice > selectedProduct.price && (
                      <span className="text-xs text-gray-400 line-through">₹{selectedProduct.originalPrice}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Delivering To:</h3>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700">
                  <p className="font-semibold">{address.name} <span className="text-gray-400 font-normal ml-2">{address.phone}</span></p>
                  <p className="mt-1">{address.addressLine}</p>
                  <p>PIN: {address.pincode}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-2">
                 <div className="flex justify-between text-sm text-gray-600">
                   <span>Item Price</span>
                   <span>₹{selectedProduct.originalPrice}</span>
                 </div>
                 <div className="flex justify-between text-sm text-green-600">
                   <span>Flash Discount</span>
                   <span>-₹{selectedProduct.originalPrice - selectedProduct.price}</span>
                 </div>
                 <div className="flex justify-between text-sm text-gray-600">
                   <span>Delivery Fee</span>
                   <span className="text-green-600">FREE</span>
                 </div>
                 <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-lg mt-2">
                   <span>Total Payable</span>
                   <span>₹{selectedProduct.price}</span>
                 </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

              <button 
                onClick={initiatePayment}
                disabled={paying}
                className="w-full h-[50px] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-colors mt-4 flex justify-center items-center gap-2 shadow-sm shadow-blue-600/30 text-lg"
              >
                {paying ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Pay Now'}
              </button>
            </div>
          </motion.div>
        )}

        {view === 'STATUS' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto space-y-6">
             <button onClick={goBackToProducts} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Store
            </button>

            {checking ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
                <h3 className="text-lg font-semibold text-gray-900">Verifying Payment...</h3>
                <p className="text-sm text-gray-500">Please do not press back or refresh.</p>
              </div>
            ) : orderData ? (
               <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6 text-center">
                 {orderData.order?.order_status === 'PAID' || orderData.order?.order_status === 'SUCCESS' ? (
                    <>
                      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                         <CheckCircle className="w-10 h-10 text-green-500" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
                        <p className="text-gray-500">Your order has been placed successfully.</p>
                      </div>
                    </>
                 ) : (
                    <>
                      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                         <AlertCircle className="w-10 h-10 text-red-500" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900">Payment Failed or Pending</h2>
                        <p className="text-gray-500">The transaction couldn't be completed. Status: {orderData.order?.order_status}</p>
                      </div>
                    </>
                 )}

                 <div className="bg-gray-50 p-4 rounded-xl text-left border border-gray-100 space-y-3 mt-6">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-gray-500 uppercase tracking-wider font-semibold text-xs">Order ID</span>
                     <span className="font-mono font-medium">{orderData.order?.order_id}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-gray-500 uppercase tracking-wider font-semibold text-xs">Amount</span>
                     <span className="font-semibold text-gray-900">₹{orderData.order?.order_amount}</span>
                   </div>
                 </div>

                 <button 
                  onClick={() => setView('PRODUCTS')}
                  className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors mt-4"
                >
                  Continue Shopping
                </button>
               </div>
            ) : (
               <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                     <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">Order Not Found</h3>
                  <p className="text-sm text-gray-500 mb-6">{error || 'Could not retrieve your order details.'}</p>
                  <button onClick={() => setView('PRODUCTS')} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors">
                    Return to Store
                  </button>
               </div>
            )}
          </motion.div>
        )}

        {view === 'ORDERS' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-3xl mx-auto space-y-6">
             <button onClick={goBackToProducts} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Store
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h2>
            
            {loadingOrders ? (
               <div className="py-12 flex justify-center">
                 <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
               </div>
            ) : ordersList.filter((o: any) => o.status !== 'DRAFT').length === 0 ? (
               <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm text-gray-500">
                 No orders found.
               </div>
            ) : (
               <div className="space-y-4">
                 {ordersList.filter((o: any) => o.status !== 'DRAFT').map(order => (
                   <OrderCard 
                     key={order.id} 
                     order={order} 
                     onClick={() => { setSelectedOrder(order); setView('ORDER_DETAIL'); }} 
                   />
                 ))}
               </div>
            )}
          </motion.div>
        )}

        {view === 'ORDER_DETAIL' && selectedOrder && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto space-y-6">
            <button onClick={goBackToOrders} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Orders
            </button>
            <OrderCard order={selectedOrder} isDetail={true} />
          </motion.div>
        )}

        {view === 'CART' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto space-y-6 pb-24">
            <h2 className="text-2xl font-bold text-gray-900">Your Cart</h2>
            {cart.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm text-gray-500">
                Your cart is empty.
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => { setSelectedProduct(item); setView('PRODUCT_DETAILS'); }}
                    className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-4 cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    <img src={item.image || (item.images && item.images[0])} alt="Product" className="w-20 h-20 rounded-lg object-cover bg-gray-200" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-2">{item.title || item.name}</h3>
                      <div className="mt-2 text-lg font-bold text-gray-900">₹{item.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Global Bottom Navigation */}
      {['PRODUCTS', 'CART', 'ORDERS', 'ORDER_DETAIL'].includes(view) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] pb-safe">
          <div className="flex justify-around items-center h-16 max-w-md mx-auto">
            <button 
              onClick={() => { setView('PRODUCTS'); setSelectedProduct(null); }} 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'PRODUCTS' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Home</span>
            </button>
            <button 
              onClick={() => { setView('CART'); setSelectedProduct(null); }} 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${view === 'CART' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && <span className="absolute top-2 right-[calc(50%-16px)] bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">{cart.length}</span>}
              <span className="text-[10px] font-medium uppercase tracking-wider">Cart</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
