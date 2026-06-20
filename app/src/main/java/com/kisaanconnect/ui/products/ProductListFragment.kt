package com.kisaanconnect.ui.products

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.GridLayoutManager
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentProductListBinding
import com.kisaanconnect.ui.adapters.ProductListAdapter
import com.kisaanconnect.ui.viewmodel.ProductViewModel
import com.kisaanconnect.utils.*

class ProductListFragment : Fragment() {
    private var _binding: FragmentProductListBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ProductViewModel by activityViewModels()
    private lateinit var adapter: ProductListAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProductListBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSearch()
        setupSwipeRefresh()
        observeProducts()
        viewModel.loadProducts()
    }

    private fun setupRecyclerView() {
        adapter = ProductListAdapter(
            onProductClick = { product ->
                val bundle = Bundle().apply { putInt("productId", product.id) }
                findNavController().navigate(R.id.action_productListFragment_to_productDetailFragment, bundle)
            },
            onCartClick = { product ->
                viewModel.addToCart(product)
                toast("${product.name} added to cart 🛒")
            }
        )
        binding.rvProducts.adapter = adapter
        binding.rvProducts.layoutManager = GridLayoutManager(requireContext(), 2)
    }

    private fun setupSearch() {
        binding.etSearch.doAfterTextChanged { text ->
            viewModel.searchProducts(text.toString())
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeResources(R.color.brand_green)
        binding.swipeRefresh.setOnRefreshListener { viewModel.loadProducts() }
    }

    private fun observeProducts() {
        viewModel.products.observe(viewLifecycleOwner) { state ->
            binding.swipeRefresh.isRefreshing = false
            when (state) {
                is Resource.Loading -> {
                    binding.shimmer.show(); binding.shimmer.startShimmer()
                    binding.rvProducts.hide()
                    binding.tvEmpty.hide()
                }
                is Resource.Success -> {
                    binding.shimmer.stopShimmer(); binding.shimmer.hide()
                    binding.rvProducts.show()
                    val products = state.data.products ?: emptyList()
                    adapter.submitList(products)
                    binding.tvEmpty.showIf(products.isEmpty())
                }
                is Resource.Error -> {
                    binding.shimmer.stopShimmer(); binding.shimmer.hide()
                    binding.rvProducts.show()
                    toast(state.message)
                }
                else -> { binding.shimmer.hide() }
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
