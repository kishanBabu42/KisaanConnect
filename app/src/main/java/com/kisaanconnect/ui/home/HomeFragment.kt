package com.kisaanconnect.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentHomeBinding
import com.kisaanconnect.ui.adapters.CategoryAdapter
import com.kisaanconnect.ui.adapters.ProductCardAdapter
import com.kisaanconnect.ui.viewmodel.HomeViewModel
import com.kisaanconnect.ui.viewmodel.ProductViewModel
import com.kisaanconnect.utils.*

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val homeVm: HomeViewModel by activityViewModels()
    private val productVm: ProductViewModel by activityViewModels()
    private lateinit var featuredAdapter: ProductCardAdapter
    private lateinit var categoryAdapter: CategoryAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupGreeting()
        setupSearch()
        setupCategories()
        setupFeaturedProducts()
        setupSwipeRefresh()
        observeData()
        loadData()
    }

    private fun setupGreeting() {
        val user = KisaanApp.instance.prefs.currentUser
        val name = user?.displayName() ?: "there"
        binding.tvGreeting.text = "${getGreeting()}, $name! 👋"
        binding.tvSubtitle.text = "What are you looking for today?"
    }

    private fun setupSearch() {
        binding.searchBar.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_searchFragment)
        }
    }

    private fun setupCategories() {
        categoryAdapter = CategoryAdapter { category ->
            productVm.filterByCategory(category.id)
            findNavController().navigate(R.id.action_homeFragment_to_productListFragment)
        }
        binding.rvCategories.apply {
            layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
            adapter = categoryAdapter
        }
        categoryAdapter.submitList(CategoryAdapter.getDefaultCategories())
    }

    private fun setupFeaturedProducts() {
        featuredAdapter = ProductCardAdapter(
            onProductClick = { product ->
                val bundle = Bundle().apply { putInt("productId", product.id) }
                findNavController().navigate(R.id.action_homeFragment_to_productDetailFragment, bundle)
            },
            onWishlistClick = { product ->
                val added = productVm.toggleWishlist(product.id)
                toast(if (added) "Added to wishlist ❤️" else "Removed from wishlist")
            },
            onAddToCartClick = { product ->
                productVm.addToCart(product)
                toast("${product.name} added to cart 🛒")
            }
        )
        binding.rvFeatured.apply {
            layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
            adapter = featuredAdapter
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeResources(R.color.brand_green)
        binding.swipeRefresh.setOnRefreshListener { loadData() }
    }

    private fun loadData() {
        homeVm.loadFeatured()
        homeVm.loadWallet(KisaanApp.instance.prefs.userId)
    }

    private fun observeData() {
        homeVm.featuredProducts.observe(viewLifecycleOwner) { state ->
            binding.swipeRefresh.isRefreshing = false
            when (state) {
                is Resource.Loading -> {
                    binding.shimmerFeatured.show()
                    binding.shimmerFeatured.startShimmer()
                    binding.rvFeatured.hide()
                }
                is Resource.Success -> {
                    binding.shimmerFeatured.stopShimmer()
                    binding.shimmerFeatured.hide()
                    binding.rvFeatured.show()
                    featuredAdapter.submitList(state.data.products ?: emptyList())
                }
                is Resource.Error -> {
                    binding.shimmerFeatured.stopShimmer()
                    binding.shimmerFeatured.hide()
                    binding.rvFeatured.show()
                    toast(state.message)
                }
                else -> {}
            }
        }

        homeVm.walletBalance.observe(viewLifecycleOwner) { balance ->
            binding.tvWalletBalance.text = balance.toRupees()
        }

        productVm.cart.observe(viewLifecycleOwner) { items ->
            val count = items.sumOf { it.quantity.toInt() }
            binding.tvCartBadge.showIf(count > 0)
            binding.tvCartBadge.text = count.toString()
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
