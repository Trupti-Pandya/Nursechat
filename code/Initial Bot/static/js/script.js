document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const clearBtn = document.getElementById('clear-btn');
    const summaryBtn = document.getElementById('summary-btn');
    const summaryModal = document.getElementById('summary-modal');
    const summaryContent = document.getElementById('summary-content');
    const closeModal = document.querySelector('.close');
    
    // Scroll to bottom of chat
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Add message to chat
    function addMessage(content, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const paragraph = document.createElement('p');
        paragraph.textContent = content;
        
        messageContent.appendChild(paragraph);
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        scrollToBottom();
    }
    
    // Update entire conversation
    function updateConversation(conversation) {
        chatMessages.innerHTML = '';
        
        conversation.forEach(message => {
            addMessage(message.content, message.role === 'user');
        });
        
        scrollToBottom();
    }
    
    // Handle form submission
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to UI
        addMessage(message, true);
        
        // Clear input
        userInput.value = '';
        
        // Disable input while waiting for response
        userInput.disabled = true;
        
        // Send message to server
        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `message=${encodeURIComponent(message)}`
        })
        .then(response => response.json())
        .then(data => {
            // Add assistant response to UI
            addMessage(data.response, false);
            
            // Re-enable input
            userInput.disabled = false;
            userInput.focus();
        })
        .catch(error => {
            console.error('Error:', error);
            addMessage('Sorry, there was an error processing your request.', false);
            userInput.disabled = false;
        });
    });
    
    // Clear conversation
    clearBtn.addEventListener('click', function() {
        fetch('/clear', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateConversation(data.conversation);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
    
    // Generate and show summary
    summaryBtn.addEventListener('click', function() {
        summaryContent.textContent = 'Generating summary...';
        summaryModal.style.display = 'block';
        
        fetch('/summary')
        .then(response => response.json())
        .then(data => {
            summaryContent.textContent = data.summary;
        })
        .catch(error => {
            console.error('Error:', error);
            summaryContent.textContent = 'Error generating summary.';
        });
    });
    
    // Close modal
    closeModal.addEventListener('click', function() {
        summaryModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === summaryModal) {
            summaryModal.style.display = 'none';
        }
    });
    
    // Focus input on page load
    userInput.focus();
    
    // Initial scroll to bottom
    scrollToBottom();
}); 