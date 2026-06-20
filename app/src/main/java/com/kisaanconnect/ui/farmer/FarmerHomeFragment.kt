package com.kisaanconnect.ui.farmer

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentFarmerHomeBinding
import com.kisaanconnect.ui.adapters.BidAdapter
import com.kisaanconnect.ui.viewmodel.FarmerDashboardViewModel
import com.kisaanconnect.utils.*
import java.util.Calendar

class FarmerHomeFragment : Fragment() {

    private var _binding: FragmentFarmerHomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: FarmerDashboardViewModel by activityViewModels()
    private lateinit var bidAdapter: BidAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentFarmerHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupGreeting()
        setupBidsRecycler()
        setupClickListeners()
        setupSwipeRefresh()
        observeData()
        loadData()
    }

    private fun setupGreeting() {
        val user = KisaanApp.instance.prefs.currentUser
        binding.tvGreeting.text = "${getGreeting()}, ${user?.displayName()} 🌾"
        binding.tvDate.text = java.text.SimpleDateFormat("EEE, dd MMM yyyy", java.util.Locale.getDefault())
            .format(Calendar.getInstance().time)
    }

    private fun setupBidsRecycler() {
        bidAdapter = BidAdapter(
            onAccept = { bid ->
                viewModel.acceptBid(bid.id)
                toast("Bid accepted! ✅")
                loadData()
            },
            onReject = { bid ->
                viewModel.rejectBid(bid.id)
                toast("Bid rejected")
                loadData()
            }
        )
        binding.rvRecentBids.adapter = bidAdapter
    }

    private fun setupClickListeners() {
        binding.btnAddCrop.setOnClickListener {
            findNavController().navigate(R.id.action_farmerHomeFragment_to_addProductFragment)
        }
        binding.btnViewAllBids.setOnClickListener {
            findNavController().navigate(R.id.farmerBidsFragment)
        }
        binding.btnKisaanAi.setOnClickListener {
            findNavController().navigate(R.id.action_farmerHomeFragment_to_aiChatFragment)
        }
        binding.btnWorkPlanner.setOnClickListener {
            findNavController().navigate(R.id.action_farmerHomeFragment_to_workPlannerFragment)
        }
        binding.btnCropDiagnosis.setOnClickListener {
            toast("Crop diagnosis feature coming soon! 🔬")
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeResources(R.color.brand_green)
        binding.swipeRefresh.setOnRefreshListener { loadData() }
    }

    private fun loadData() {
        val farmerId = KisaanApp.instance.prefs.userId
        viewModel.loadAll(farmerId)
    }

    private fun observeData() {
        viewModel.walletBalance.observe(viewLifecycleOwner) { balance ->
            binding.tvWalletBalance.text = balance.toRupees()
        }

        viewModel.totalEarnings.observe(viewLifecycleOwner) { earnings ->
            binding.tvTotalEarnings.text = earnings.toRupees()
        }

        viewModel.products.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Success -> {
                    val count = state.data.products?.size ?: 0
                    binding.tvTotalCrops.text = count.toString()
                }
                else -> {}
            }
        }

        viewModel.bids.observe(viewLifecycleOwner) { state ->
            binding.swipeRefresh.isRefreshing = false
            when (state) {
                is Resource.Loading -> {
                    binding.shimmerBids.show()
                    binding.shimmerBids.startShimmer()
                    binding.rvRecentBids.hide()
                }
                is Resource.Success -> {
                    binding.shimmerBids.stopShimmer()
                    binding.shimmerBids.hide()
                    binding.rvRecentBids.show()
                    val bids = state.data.take(5)
                    bidAdapter.submitList(bids)
                    binding.tvNoBids.showIf(bids.isEmpty())
                    val pending = state.data.count { it.status == "pending" }
                    binding.tvPendingBids.text = pending.toString()
                }
                is Resource.Error -> {
                    binding.shimmerBids.stopShimmer()
                    binding.shimmerBids.hide()
                    binding.rvRecentBids.show()
                    toast(state.message)
                }
                else -> {}
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
