import { Navigate, Outlet } from 'react-router-dom';

const AdminRoute = () => {
    const adminToken = localStorage.getItem('admin_token');

    if (!adminToken) {
        return <Navigate to="/admin/login" replace />;
    }

    return <Outlet />;
};

export default AdminRoute;
