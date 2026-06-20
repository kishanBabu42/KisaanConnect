package com.kisaanconnect.ui.products

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentProductDetailBinding
import com.kisaanconnect.ui.viewmodel.ProductViewModel
import com.kisaanconnect.utils.*

class ProductDetailFragment : Fragment() {
    private var _binding: FragmentProductDetailBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ProductViewModel by activityViewModels()
    private val args: ProductDetailFragmentArgs by navArgs()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProductDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }
        observeProduct()
        viewModel.loadProductById(args.productId)
    }

    private fun observeProduct() {
        viewModel.selectedProduct.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Loading -> {
                    binding.progressBar.show()
                    binding.contentGroup.hide()
                }
                is Resource.Success -> {
                    binding.progressBar.hide()
                    binding.contentGroup.show()
                    val p = state.data
                    binding.ivProduct.loadUrl(p.imageUrl)
                    binding.tvName.text = p.name
                    binding.tvPrice.text = p.formattedPrice()
                    binding.tvMarketPrice.text = "Market Price: ₹${String.format("%.0f", p.marketPrice)}/kg"
                    binding.tvQuantity.text = "${p.quantity.toInt()} kg available"
                    binding.tvFarmerName.text = p.farmerName
                    binding.tvLocation.text = p.location
                    binding.tvFreshness.text = "Freshness: ${p.freshness}"
                    binding.tvDescription.text = p.description ?: "Fresh ${p.name} directly from the farm."
                    binding.tvDelivery.text = "Estimated delivery: ${p.deliveryDays} day(s)"
                    val savings = p.savingsPercent()
                    binding.tvSavings.showIf(savings > 0)
                    binding.tvSavings.text = "You save ${savings}% vs market price!"

                    val isWishlisted = viewModel.isWishlisted(p.id)
                    binding.btnWishlist.text = if (isWishlisted) "❤️ Wishlisted" else "🤍 Wishlist"

                    binding.btnWishlist.setOnClickListener {
                        val added = viewModel.toggleWishlist(p.id)
                        binding.btnWishlist.text = if (added) "❤️ Wishlisted" else "🤍 Wishlist"
                        toast(if (added) "Added to wishlist" else "Removed from wishlist")
                    }
                    binding.btnAddCart.setOnClickListener {
                        viewModel.addToCart(p)
                        toast("${p.name} added to cart 🛒")
                    }
                    binding.btnBuyNow.setOnClickListener {
                        viewModel.addToCart(p)
                        findNavController().navigate(R.id.action_productDetailFragment_to_cartFragment)
                    }
                }
                is Resource.Error -> {
                    binding.progressBar.hide()
                    binding.contentGroup.show()
                    toast(state.message)
                }
                else -> {}
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
