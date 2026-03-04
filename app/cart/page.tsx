import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import CartPage from '@/components/CartPage'

export default function Cart() {
  return (
    <div className="cart-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="cart-main">
        <div className="container">
          <CartPage />
        </div>
      </main>
      <Footer />
    </div>
  )
}
