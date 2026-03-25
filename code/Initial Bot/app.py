import os
import openai
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, session
import uuid

# Load environment variables from .env file
load_dotenv()

# Set up OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24))

class MedicalScreeningBot:
    def __init__(self):
        # Initialize conversation history with medical screening system prompt
        self.conversation_history = [
            {"role": "system", 
             "content": """You are a concise medical screening assistant helping nurses with initial patient assessment.
             
             Your tasks:
             1. Greet the patient, introduce yourself as a MedScreenBot
             2. Gather relevant symptoms and medical history from patients
             3. Ask about duration, severity, and other relevant details of symptoms
             4. Inquire about pre-existing conditions and medications
             5. Suggest possible conditions based on reported symptoms
             6. Recommend appropriate next steps (further tests, specialist referral, etc.)
             
             IMPORTANT GUIDELINES:
             - Keep all responses under 3 sentences when possible
             - Be direct and to the point - avoid unnecessary explanations
             - Ask only one question at a time
             - Focus on the most relevant information
             - Use simple, clear language
             - Avoid lengthy disclaimers - a brief mention is sufficient
             
             Begin by briefly greeting the patient and asking about their main concern."""}
        ]
    
    def chat(self, user_input):
        # Add user message to conversation history
        if user_input.strip():  # Only add non-empty messages
            self.conversation_history.append({"role": "user", "content": user_input})
        
        try:
            # Get response from OpenAI
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=self.conversation_history,
                temperature=0.5,  # Lower temperature for more focused responses
                max_tokens=150    # Limit response length
            )
            
            # Extract assistant's message
            assistant_message = response.choices[0].message["content"]
            
            # Add assistant's response to conversation history
            self.conversation_history.append({"role": "assistant", "content": assistant_message})
            
            return assistant_message
        
        except Exception as e:
            return f"Error: {str(e)}"
    
    def get_conversation(self):
        # Return conversation history excluding system message
        return [msg for msg in self.conversation_history if msg["role"] != "system"]
    
    def clear_history(self):
        # Reset conversation history, keeping only the system message
        self.conversation_history = [
            {"role": "system", 
             "content": """You are a concise medical screening assistant helping nurses with initial patient assessment.
             
             Your tasks:
             1. Gather relevant symptoms and medical history from patients
             2. Ask about duration, severity, and other relevant details of symptoms
             3. Inquire about pre-existing conditions and medications
             4. Suggest possible conditions based on reported symptoms
             5. Recommend appropriate next steps (further tests, specialist referral, etc.)
             
             IMPORTANT GUIDELINES:
             - Keep all responses under 3 sentences when possible
             - Be direct and to the point - avoid unnecessary explanations
             - Ask only one question at a time
             - Focus on the most relevant information
             - Use simple, clear language
             - Avoid lengthy disclaimers - a brief mention is sufficient
             
             Begin by briefly greeting the patient and asking about their main concern."""}
        ]
        
    def generate_summary(self):
        """Generate a concise medical summary for the healthcare provider"""
        summary_prompt = [
            {"role": "system", "content": "Create a concise medical screening summary from the conversation. Include: 1) Main symptoms, 2) Relevant medical history, 3) Possible conditions to consider, 4) Recommended next steps. Format as a professional medical note."},
            {"role": "user", "content": str(self.conversation_history)}
        ]
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=summary_prompt,
                temperature=0.3,  # Lower temperature for more factual summary
                max_tokens=350
            )
            return response.choices[0].message["content"]
        except Exception as e:
            return f"Error generating summary: {str(e)}"

# Store chatbot instances
chatbots = {}

@app.route('/')
def index():
    # Create a unique session ID if not exists
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    
    session_id = session['session_id']
    
    # Create a new chatbot instance for this session if not exists
    if session_id not in chatbots:
        chatbots[session_id] = MedicalScreeningBot()
        # Get initial greeting
        chatbots[session_id].chat("")
    
    # Get conversation history
    conversation = chatbots[session_id].get_conversation()
    
    return render_template('index.html', conversation=conversation)

@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.form['message']
    session_id = session['session_id']
    
    if session_id not in chatbots:
        chatbots[session_id] = MedicalScreeningBot()
    
    response = chatbots[session_id].chat(user_input)
    
    return jsonify({
        'response': response,
        'conversation': chatbots[session_id].get_conversation()
    })

@app.route('/clear', methods=['POST'])
def clear():
    session_id = session['session_id']
    
    if session_id in chatbots:
        chatbots[session_id].clear_history()
        # Get initial greeting
        chatbots[session_id].chat("")
    
    return jsonify({
        'status': 'success',
        'conversation': chatbots[session_id].get_conversation()
    })

@app.route('/summary', methods=['GET'])
def summary():
    session_id = session['session_id']
    
    if session_id not in chatbots:
        return jsonify({'summary': 'No conversation data available.'})
    
    summary_text = chatbots[session_id].generate_summary()
    
    return jsonify({'summary': summary_text})

if __name__ == '__main__':
    app.run(debug=True) 