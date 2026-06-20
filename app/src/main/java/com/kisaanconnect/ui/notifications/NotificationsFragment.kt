package com.kisaanconnect.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.databinding.FragmentNotificationsBinding
import com.kisaanconnect.ui.adapters.NotificationAdapter
import com.kisaanconnect.ui.viewmodel.NotificationViewModel
import com.kisaanconnect.utils.*

class NotificationsFragment : Fragment() {
    private var _binding: FragmentNotificationsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: NotificationViewModel by activityViewModels()
    private lateinit var adapter: NotificationAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentNotificationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        adapter = NotificationAdapter { notif ->
            if (!notif.isRead) viewModel.markRead(notif.id)
        }
        binding.rvNotifications.adapter = adapter
        binding.btnMarkAll.setOnClickListener {
            viewModel.markAllRead(KisaanApp.instance.prefs.userId)
        }
        observeNotifications()
        viewModel.load(KisaanApp.instance.prefs.userId)
    }

    private fun observeNotifications() {
        viewModel.notifications.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Loading -> { binding.shimmer.show(); binding.shimmer.startShimmer(); binding.rvNotifications.hide() }
                is Resource.Success -> {
                    binding.shimmer.stopShimmer(); binding.shimmer.hide(); binding.rvNotifications.show()
                    adapter.submitList(state.data)
                    binding.tvEmpty.showIf(state.data.isEmpty())
                }
                is Resource.Error -> { binding.shimmer.stopShimmer(); binding.shimmer.hide(); binding.rvNotifications.show() }
                else -> { binding.shimmer.hide() }
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
