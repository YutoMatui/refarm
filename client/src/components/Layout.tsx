import { Outlet, useLocation } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import FloatingCartButton from './FloatingCartButton'

export default function Layout() {
  const location = useLocation();
  // Hide FAB on cart page
  const showFab = location.pathname !== '/cart';

  return (
    <div className="min-h-screen bg-gray-50 pb-24"> {/* Added padding bottom for nav */}
      <main className="max-w-md mx-auto min-h-screen bg-gray-50 relative">
        <Outlet />
        {showFab && <FloatingCartButton />}
      </main>
      <BottomNavigation />
    </div>
  )
}
