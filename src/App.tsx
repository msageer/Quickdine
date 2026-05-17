/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CustomerMenu from './pages/CustomerMenu';
import CustomerOrders from './pages/CustomerOrders';
import OrderTracking from './pages/OrderTracking';
import RestaurantDirectory from './pages/RestaurantDirectory';
import RestaurantDashboard from './pages/RestaurantDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WaiterDashboard from './pages/WaiterDashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="order" element={<CustomerMenu />} />
          <Route path="orders" element={<CustomerOrders />} />
          <Route path="profile" element={<CustomerOrders />} />
          <Route path="track/:orderId" element={<OrderTracking />} />
          <Route path="directory" element={<RestaurantDirectory />} />
          
          <Route element={<ProtectedRoute allowedRoles={['restaurant']} />}>
            <Route path="restaurant/:id" element={<RestaurantDashboard />} />
          </Route>
          
          <Route element={<ProtectedRoute allowedRoles={['waiter']} />}>
            <Route path="waiter/:id" element={<WaiterDashboard />} />
          </Route>
          
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

