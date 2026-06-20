package com.kisaanconnect.ui.cart

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentCartBinding
import com.kisaanconnect.ui.adapters.CartAdapter
import com.kisaanconnect.ui.viewmodel.ProductViewModel
import com.kisaanconnect.utils.*

class CartFragment : Fragment() {
    private var _binding: FragmentCartBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ProductViewModel by activityViewModels()
    private lateinit var cartAdapter: CartAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCartBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupClickListeners()
        observeCart()
    }

    private fun setupRecyclerView() {
        cartAdapter = CartAdapter(
            onRemove = { item -> viewModel.removeFromCart(item.product.id) },
            onQuantityChange = { item, qty -> viewModel.updateCartQuantity(item.product.id, qty) }
        )
        binding.rvCart.adapter = cartAdapter
    }

    private fun setupClickListeners() {
        binding.btnCheckout.setOnClickListener {
            if (cartAdapter.currentList.isEmpty()) {
                toast("Your cart is empty! Add some fresh produce.")
                return@setOnClickListener
            }
            toast("Checkout coming soon! 🛒")
        }
        binding.btnShopNow.setOnClickListener {
            findNavController().navigate(R.id.homeFragment)
        }
    }

    private fun observeCart() {
        viewModel.cart.observe(viewLifecycleOwner) { items ->
            cartAdapter.submitList(items.toList())
            val isEmpty = items.isEmpty()
            binding.emptyGroup.showIf(isEmpty)
            binding.cartGroup.showIf(!isEmpty)

            if (!isEmpty) {
                val summary = viewModel.getCartSummary()
                binding.tvSubtotal.text = summary.subtotal.toRupees()
                binding.tvDeliveryFee.text = if (summary.deliveryFee == 0.0) "FREE" else summary.deliveryFee.toRupees()
                binding.tvPlatformFee.text = summary.platformFee.toRupeesWithDecimal()
                binding.tvTotal.text = summary.total.toRupees()
                binding.btnCheckout.text = "Checkout ${summary.total.toRupees()}"
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
