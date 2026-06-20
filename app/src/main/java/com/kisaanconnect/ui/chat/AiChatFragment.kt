package com.kisaanconnect.ui.chat

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.databinding.FragmentAiChatBinding
import com.kisaanconnect.ui.adapters.ChatAdapter
import com.kisaanconnect.ui.viewmodel.AiViewModel
import com.kisaanconnect.utils.show
import com.kisaanconnect.utils.hide

class AiChatFragment : Fragment() {
    private var _binding: FragmentAiChatBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AiViewModel by activityViewModels()
    private lateinit var chatAdapter: ChatAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAiChatBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val layoutManager = LinearLayoutManager(requireContext())
        layoutManager.stackFromEnd = true
        chatAdapter = ChatAdapter()
        binding.rvMessages.layoutManager = layoutManager
        binding.rvMessages.adapter = chatAdapter

        binding.btnSend.setOnClickListener { sendMessage() }
        binding.etMessage.setOnEditorActionListener { _, _, _ -> sendMessage(); true }
        binding.btnClear.setOnClickListener { viewModel.clearChat() }
        binding.toolbar.setNavigationOnClickListener { requireActivity().onBackPressedDispatcher.onBackPressed() }

        // Quick suggestion chips
        listOf(
            binding.chipDisease,
            binding.chipWeather,
            binding.chipPrice,
            binding.chipFertilizer
        ).forEachIndexed { i, chip ->
            chip.setOnClickListener {
                binding.etMessage.setText(chip.text)
                sendMessage()
            }
        }

        observeViewModel()
    }

    private fun sendMessage() {
        val msg = binding.etMessage.text.toString().trim()
        if (msg.isBlank()) return
        binding.etMessage.setText("")
        val role = KisaanApp.instance.prefs.userRole.ifBlank { "farmer" }
        viewModel.send(msg, role)
    }

    private fun observeViewModel() {
        viewModel.messages.observe(viewLifecycleOwner) { messages ->
            chatAdapter.submitList(messages.toList())
            if (messages.isNotEmpty()) {
                binding.rvMessages.scrollToPosition(messages.size - 1)
            }
            binding.tvWelcome.visibility = if (messages.isEmpty()) View.VISIBLE else View.GONE
        }
        viewModel.sending.observe(viewLifecycleOwner) { isSending ->
            binding.btnSend.isEnabled = !isSending
            binding.typingIndicator.visibility = if (isSending) View.VISIBLE else View.GONE
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
