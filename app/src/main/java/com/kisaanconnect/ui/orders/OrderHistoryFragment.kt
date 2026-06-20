package com.kisaanconnect.ui.orders

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.databinding.FragmentOrderHistoryBinding
import com.kisaanconnect.ui.adapters.OrderAdapter
import com.kisaanconnect.ui.viewmodel.OrderViewModel
import com.kisaanconnect.utils.*

class OrderHistoryFragment : Fragment() {
    private var _binding: FragmentOrderHistoryBinding? = null
    private val binding get() = _binding!!
    private val viewModel: OrderViewModel by activityViewModels()
    private lateinit var adapter: OrderAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOrderHistoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        adapter = OrderAdapter { order -> toast("Order #${order.orderId}: ${order.statusLabel()}") }
        binding.rvOrders.adapter = adapter
        binding.swipeRefresh.setOnRefreshListener { loadOrders() }
        observeOrders()
        loadOrders()
    }

    private fun loadOrders() {
        viewModel.loadOrders(KisaanApp.instance.prefs.userId)
    }

    private fun observeOrders() {
        viewModel.orders.observe(viewLifecycleOwner) { state ->
            binding.swipeRefresh.isRefreshing = false
            when (state) {
                is Resource.Loading -> { binding.shimmer.show(); binding.shimmer.startShimmer(); binding.rvOrders.hide() }
                is Resource.Success -> {
                    binding.shimmer.stopShimmer(); binding.shimmer.hide(); binding.rvOrders.show()
                    val orders = state.data
                    adapter.submitList(orders)
                    binding.tvEmpty.showIf(orders.isEmpty())
                }
                is Resource.Error -> {
                    binding.shimmer.stopShimmer(); binding.shimmer.hide(); binding.rvOrders.show()
                    toast(state.message)
                }
                else -> { binding.shimmer.hide() }
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
