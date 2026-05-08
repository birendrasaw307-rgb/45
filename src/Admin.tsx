import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Upload, Plus, Image as ImageIcon, CheckCircle, XCircle, Search, Loader2, ShieldCheck, Trash2, Pencil, Crop as CropIcon } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './lib/cropImage';

function PhotoPreview({ item, onRemove, onPencilClick }: { item: string | File; onRemove: () => void; onPencilClick: (url: string) => void }) {
  const [url, setUrl] = React.useState<string>('');
  
  React.useEffect(() => {
    if (typeof item === 'string') {
      setUrl(item);
    } else if (item) {
      const objectUrl = URL.createObjectURL(item as any);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [item]);

  if (!url) return null;

  return (
    <>
      <img src={url} alt="upload" className="w-full h-full object-cover" />
      <div className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow-sm cursor-pointer hover:bg-white z-10" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <XCircle className="w-4 h-4 text-gray-700" />
      </div>
      <div 
        className="absolute bottom-2 right-2 bg-blue-600 p-2 rounded-full cursor-pointer shadow-md z-10 transition-transform active:scale-95"
        onClick={() => onPencilClick(url)}
      >
        <Pencil className="w-4 h-4 text-white" />
      </div>
    </>
  );
}

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'ORDERS'>('PRODUCTS');

  // Products
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [productSuccess, setProductSuccess] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Categories
  const [categoryName, setCategoryName] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // All Products
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Cropping
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropIndex, setCropIndex] = useState<number>(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImageFile = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      if (croppedImageFile) {
        const newPhotos = [...photos];
        newPhotos[cropIndex] = croppedImageFile;
        setPhotos(newPhotos);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to crop image.');
    }
    setCropModalOpen(false);
    setCropImageSrc(null);
  };

  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Payments Check
  const [paymentOrderId, setPaymentOrderId] = useState('');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'PRODUCTS' && user) {
      fetchAllProducts();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'ORDERS' && user) {
      fetchOrders();
    }
  }, [activeTab, user]);

  const fetchAllProducts = async () => {
    setLoadingProducts(true);
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setAllProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      if(err?.message !== "Network Error") console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const q = query(collection(db, 'categories'));
      const snap = await getDocs(q);
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      if(err?.message !== "Network Error") console.error(err);
      alert('Categories fetch error: ' + err.message);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const q = query(collection(db, 'orders'));
      const snap = await getDocs(q);
      const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedOrders.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      setOrders(fetchedOrders);
    } catch (err: any) {
      if(err?.message !== "Network Error") console.error(err);
      alert('Orders fetch error: ' + err.message);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: categoryName,
        createdAt: serverTimestamp()
      });
      setCategoryName('');
      fetchCategories();
    } catch(err: any) {
      if(err?.message !== "Network Error") console.error(err);
      alert(err.message || 'Failed to add category');
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;
    try {
      await updateDoc(doc(db, 'categories', id), {
        name: editingCategoryName
      });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      fetchCategories();
    } catch(err: any) {
      if(err?.message !== "Network Error") console.error(err);
      alert(err.message || 'Failed to update category');
    }
  };

  const handleCreateOrUpdateProduct = async () => {
    const validPhotos = photos.filter(p => p != null && p !== undefined);
    if (!title || !amount || !categoryId || validPhotos.length === 0) {
      alert('Please fill everything and provide at least 1 photo.');
      return;
    }
    setUploading(true);
    setProductSuccess('');
    try {
      // 1. Upload new photos to API
      const finalImageUrls: string[] = [];
      for (const item of validPhotos) {
        if (typeof item === 'string') {
          // Already an uploaded URL
          finalImageUrls.push(item);
        } else {
          // It's a new File
          const formData = new FormData();
          formData.append('file', item);
          const res = await axios.post('/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          finalImageUrls.push(res.data.url);
        }
      }

      // 2. Save product to Firestore
      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), {
          title,
          price: Number(amount),
          originalPrice: Number(amount) + Number(discount || 0),
          discount: Number(discount || 0),
          categoryId,
          images: finalImageUrls,
          updatedAt: serverTimestamp()
        });
        setProductSuccess('Product updated successfully!');
      } else {
        await addDoc(collection(db, 'products'), {
          title,
          price: Number(amount),
          originalPrice: Number(amount) + Number(discount || 0),
          discount: Number(discount || 0),
          categoryId,
          images: finalImageUrls,
          createdAt: serverTimestamp()
        });
        setProductSuccess('Product uploaded successfully!');
      }

      setTitle('');
      setAmount('');
      setDiscount('');
      setCategoryId('');
      setPhotos([]);
      setEditingProductId(null);
      fetchAllProducts();
    } catch(err: any) {
      if(err?.message !== "Network Error") console.error(err);
      alert('Failed to save product.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditProduct = (prod: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditingProductId(prod.id);
    setTitle(prod.title || prod.name || '');
    setAmount(prod.price?.toString() || '');
    setDiscount(prod.discount?.toString() || (prod.originalPrice ? (prod.originalPrice - prod.price).toString() : ''));
    setCategoryId(prod.categoryId || '');
    setPhotos(prod.images || [prod.image] || []);
    setProductSuccess('');
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      fetchAllProducts();
    } catch (err: any) {
      if(err?.message !== "Network Error") console.error(err);
      alert('Failed to delete product.');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
      fetchOrders();
    } catch(err) {
      if(err?.message !== "Network Error") console.error(err);
    }
  };

  const handleBulkDeleteInvalid = async () => {
    if (!confirm("Are you sure you want to delete all invalid/empty orders?")) return;
    try {
      setLoadingOrders(true);
      const invalidOrders = orders.filter(
        (o) => o.status === 'DRAFT' || (!o.product?.title && !o.product?.name && !o.product?.image) || (o.status === 'PENDING' && (!o.product?.name && !o.product?.title))
      );
      
      let count = 0;
      for (const order of invalidOrders) {
         await deleteDoc(doc(db, 'orders', order.id));
         count++;
      }
      alert(`Deleted ${count} invalid orders.`);
      fetchOrders();
    } catch(err) {
      console.error(err);
      alert("Failed to delete orders");
      setLoadingOrders(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!paymentOrderId.trim()) return;
    setCheckingPayment(true);
    setPaymentError('');
    setPaymentData(null);
    try {
      const res = await axios.get(`/api/check-order/${paymentOrderId.trim()}`);
      setPaymentData(res.data);
    } catch(err: any) {
      if(err?.message !== "Network Error") console.error(err);
      setPaymentError(err.response?.data?.error || 'Failed to fetch payment status');
    } finally {
      setCheckingPayment(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <h2 className="text-xl font-bold bg-yellow-100 px-4 py-2 rounded text-yellow-800">Admin Section</h2>
        <p>You must be signed in to manage the store.</p>
        <Link to="/" className="text-blue-600 font-bold hover:underline">Go to Store Login</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-xl font-bold px-2 text-blue-400 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Admin Panel
          </h1>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['PRODUCTS', 'ORDERS'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                {tab === 'ORDERS' ? 'Order Requests' : 'Manage Products'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'PRODUCTS' && (
          <div className="flex flex-col xl:flex-row gap-6 max-w-6xl">
            {/* Products Column */}
            <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <h2 className="text-xl font-bold">Add Product</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Title</label>
                  <input type="text" className="w-full border bg-white text-gray-900 rounded-xl px-4 py-3" value={title} onChange={e => setTitle(e.target.value)} placeholder="Product Name" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Amount (Final Price)</label>
                    <input type="number" className="w-full border bg-white text-gray-900 rounded-xl px-4 py-3" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Discount Amount</label>
                    <input type="number" className="w-full border bg-white text-gray-900 rounded-xl px-4 py-3" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="e.g. 100" />
                  </div>
                </div>

                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Category</label>
                    <select className="w-full border bg-white text-gray-900 rounded-xl px-4 py-3" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                      <option value="">Select a Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Photos (Exactly 3)</label>
                  <div className="flex gap-4">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex-1 aspect-square border-2 border-dashed border-gray-300 rounded-xl relative flex flex-col items-center justify-center bg-gray-50 overflow-hidden group">
                        {photos[index] ? (
                          <PhotoPreview 
                            item={photos[index]} 
                            onRemove={() => {
                              const newPhotos = [...photos];
                              newPhotos[index] = null;
                              setPhotos(newPhotos);
                            }}
                            onPencilClick={(url) => {
                              setCropIndex(index);
                              setCropImageSrc(url);
                              setCropModalOpen(true);
                            }}
                          />
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-xs font-medium text-gray-500">Box {index + 1}</span>
                            <div className="absolute inset-0 bg-transparent cursor-pointer">
                              <input type="file" accept="image/*" onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const newPhotos = [...photos];
                                  newPhotos[index] = e.target.files[0];
                                  setPhotos(newPhotos);
                                  e.target.value = ''; // Reset input
                                }
                              }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {productSuccess && <div className="p-3 bg-green-50 text-green-700 rounded-xl font-medium text-sm">{productSuccess}</div>}

                <div className="flex gap-4">
                  {editingProductId && (
                    <button 
                      onClick={() => {
                        setEditingProductId(null);
                        setTitle('');
                        setAmount('');
                        setDiscount('');
                        setCategoryId('');
                        setPhotos([]);
                      }}
                      className="py-4 px-6 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button 
                    onClick={handleCreateOrUpdateProduct}
                    disabled={uploading}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {uploading ? 'Publishing...' : (editingProductId ? 'Update Product' : 'Publish Product')}
                  </button>
                </div>
              </div>

              {/* All Products List */}
              <div className="mt-12 space-y-6">
                <h2 className="text-xl font-bold">All Products</h2>
                {loadingProducts ? (
                  <div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                ) : allProducts.length === 0 ? (
                  <p className="text-gray-500">No products found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {allProducts.map(prod => (
                      <div key={prod.id} className="border rounded-xl p-4 flex gap-4 bg-gray-50 items-start">
                        <img src={prod.images?.[0] || prod.image} alt={prod.title} className="w-20 h-20 bg-gray-200 object-cover rounded-lg" />
                        <div className="flex-1 space-y-1">
                          <h3 className="font-bold text-gray-900 line-clamp-1">{prod.title || prod.name}</h3>
                          <p className="text-sm font-semibold text-blue-600">₹{prod.price}</p>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleEditProduct(prod)} className="bg-white border hover:bg-gray-100 px-3 py-1 rounded text-sm font-medium text-gray-700 flex items-center gap-1">
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => handleDeleteProduct(prod.id)} className="bg-white border hover:bg-red-50 text-red-600 px-3 py-1 rounded text-sm font-medium flex items-center gap-1">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Categories Column */}
            <div className="w-full xl:w-96 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h2 className="text-xl font-bold mb-4">Categories</h2>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text"
                  placeholder="New category..."
                  className="flex-1 border bg-white text-gray-900 rounded-xl px-4 py-2 text-sm"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                />
                <button onClick={handleAddCategory} className="bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium text-sm">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <ul className="space-y-2 flex-1 overflow-y-auto">
                {categories.map(c => (
                  <li key={c.id} className="p-3 bg-gray-50 border rounded-xl flex justify-between items-center text-sm">
                    {editingCategoryId === c.id ? (
                      <div className="flex gap-2 w-full items-center">
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="flex-1 border bg-white rounded-lg px-2 py-1 text-gray-900"
                        />
                        <button onClick={() => handleUpdateCategory(c.id)} className="text-green-600 hover:text-green-700">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }} className="text-red-500 hover:text-red-600">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-gray-700">{c.name}</span>
                        <button 
                          onClick={() => { setEditingCategoryId(c.id); setEditingCategoryName(c.name); }} 
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
                {categories.length === 0 && <p className="text-gray-400 text-sm">No categories found.</p>}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="space-y-6 max-w-4xl">
            {/* Check Payment Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Search className="w-5 h-5" /> Check Payment Status</h2>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Enter Order ID to verify payment"
                  className="flex-1 border bg-white text-gray-900 rounded-xl px-4 py-3 font-mono"
                  value={paymentOrderId}
                  onChange={e => setPaymentOrderId(e.target.value)}
                />
                <button 
                  onClick={handleCheckPayment}
                  disabled={checkingPayment || !paymentOrderId}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  {checkingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
                </button>
              </div>

              {paymentError && <div className="p-4 bg-red-50 text-red-600 rounded-xl">{paymentError}</div>}

              {paymentData && (
                 <div className="border rounded-xl p-6 bg-slate-50 space-y-4">
                   <h3 className="font-bold text-lg mb-4 border-b pb-2">Response from Cashfree</h3>
                   <div className="grid grid-cols-2 gap-4 text-sm">
                     <div>
                       <p className="text-gray-500 font-semibold mb-1">Status</p>
                       <p className={`font-bold uppercase ${paymentData.order?.order_status === 'PAID' ? 'text-green-600' : 'text-orange-600'}`}>
                         {paymentData.order?.order_status || 'UNKNOWN'}
                       </p>
                     </div>
                     <div>
                       <p className="text-gray-500 font-semibold mb-1">Amount</p>
                       <p className="font-bold">₹{paymentData.order?.order_amount}</p>
                     </div>
                     <div className="col-span-2">
                       <p className="text-gray-500 font-semibold mb-1">Order ID</p>
                       <p className="font-mono bg-white border px-3 py-2 rounded-lg mt-1 inline-block">
                         {paymentData.order?.order_id}
                       </p>
                     </div>
                   </div>
                 </div>
              )}
            </div>

            {/* Orders Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Order Requests</h2>
                <button 
                  onClick={handleBulkDeleteInvalid}
                  className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Clean Invalid
                </button>
              </div>
              {loadingOrders ? (
                 <div className="flex justify-center py-8">
                   <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                 </div>
              ) : orders.filter(o => o.status !== 'DRAFT').length === 0 ? (
                 <p className="text-gray-400 text-center py-8">No orders found.</p>
              ) : (
                 <div className="space-y-4">
                   {orders.filter(o => o.status !== 'DRAFT').map(order => (
                     <div key={order.id} className="border rounded-xl p-5 bg-gray-50 flex flex-col lg:flex-row gap-6">
                       <div className="flex-1 space-y-3">
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                             <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">{order.orderId || order.id}</span>
                             <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                               order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                               order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                               order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                               'bg-gray-100 text-gray-700'
                             }`}>{order.status || 'UNKNOWN'}</span>
                           </div>
                         </div>
                         
                         <div className="flex gap-4 items-center">
                           {order.product?.images?.[0] ? (
                             <img src={order.product.images[0]} alt="Product" className="w-16 h-16 rounded-md object-cover bg-gray-200" />
                           ) : order.product?.image ? (
                             <img src={order.product.image} alt="Product" className="w-16 h-16 rounded-md object-cover bg-gray-200" />
                           ) : (
                             <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center text-xs text-gray-500">No Image</div>
                           )}
                           <div>
                             <p className="font-bold text-gray-900">{order.product?.name || order.product?.title || 'Unknown Product'}</p>
                             <p className="text-sm text-gray-600">Total: ₹{order.amount || 0}</p>
                           </div>
                         </div>
                       </div>
                       
                       <div className="flex-1 bg-white p-3 rounded-lg border text-sm text-gray-700">
                         <div className="flex justify-between items-center border-b pb-1 mb-1">
                           <p className="font-semibold text-gray-900">Delivery Info</p>
                           {order.status === 'PENDING' && <span className="text-green-600 font-bold bg-green-50 px-2 rounded-md text-xs py-0.5">Paid</span>}
                         </div>
                         <p className="text-gray-900">Name: {order.address?.name || 'N/A'}</p>
                         <p className="text-gray-900">Phone: {order.address?.phone || 'N/A'}</p>
                         <p className="line-clamp-2 text-gray-900">Address: {order.address?.addressLine || 'N/A'}, {order.address?.pincode || 'N/A'}</p>
                       </div>

                       <div className="flex flex-col gap-2 justify-center lg:w-32">
                         {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                           <>
                             <button onClick={() => updateOrderStatus(order.id, 'COMPLETED')} className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                               <CheckCircle className="w-4 h-4" /> Accept
                             </button>
                             <button onClick={() => updateOrderStatus(order.id, 'CANCELLED')} className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                               <XCircle className="w-4 h-4" /> Reject
                             </button>
                           </>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Cropper Modal */}
      {cropModalOpen && cropImageSrc && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div style={{ position: 'relative', width: '100%', maxWidth: '500px', height: '400px', minHeight: '400px' }} className="bg-gray-900 rounded-xl overflow-hidden mb-6">
            <Cropper
              image={cropImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="flex gap-4 z-50">
            <button 
              onClick={() => { setCropModalOpen(false); setCropImageSrc(null); }} 
              className="px-6 py-3 bg-gray-800 text-white font-bold rounded-xl"
            >
              Cancel
            </button>
            <button 
              onClick={handleCropSave}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl"
            >
              Crop & Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
