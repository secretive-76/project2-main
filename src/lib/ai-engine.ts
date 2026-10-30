interface ResponseRule {
  keywords: string[];
  response: string;
}

const responseRules: ResponseRule[] = [
  {
    keywords: ['transformer', 'attention', 'self-attention', 'qkv', 'query key value'],
    response: `Great question! Let me break down **attention** step by step.

## The Core Idea

Attention lets a model weigh the importance of every token in a sequence when building a representation for any single token. Instead of reading tokens one-by-one (like RNNs), attention looks at *all* tokens at once and decides which matter most.

## The Formula

\`\`\`python
attention_output = softmax(Q @ K.T / sqrt(d_k)) @ V
\`\`\`

- **Q (Query):** "What am I looking for?"
- **K (Key):** "What do I contain?"
- **V (Value):** "What information do I pass along?"

## Why Divide by √d_k?

As dimensionality grows, dot products get large, pushing softmax into regions with tiny gradients. Dividing by √d_k keeps variance stable so training doesn't collapse.

## Multi-Head Attention

Instead of one attention pass, we run **h parallel heads**, each projecting Q/K/V into a lower-dimensional space, then concatenate and project the results. This lets the model attend to different relationships simultaneously — one head might track syntax, another semantics.

Would you like me to walk through a worked numerical example, or jump to implementing this in PyTorch?`,
  },
  {
    keywords: ['python', 'list', 'dictionary', 'dict', 'comprehension'],
    response: `Let's nail this down. Here's a practical breakdown.

## List Comprehensions

\`\`\`python
# Traditional
squares = []
for x in range(10):
    squares.append(x ** 2)

# Comprehension — same result, cleaner
squares = [x ** 2 for x in range(10)]

# With a condition
even_squares = [x ** 2 for x in range(10) if x % 2 == 0]
\`\`\`

## Dictionary Comprehensions

\`\`\`python
word_lengths = {word: len(word) for word in ["hello", "world", "ai"]}
# {'hello': 5, 'world': 5, 'ai': 2}
\`\`\`

> **Tip:** Comprehensions are faster than loops because they're optimized at the C level in CPython. But don't sacrifice readability — if it spans more than one line, use a regular loop.

Want to practice with a quick exercise?`,
  },
  {
    keywords: ['gradient', 'descent', 'backprop', 'backpropagation', 'loss', 'optimizer'],
    response: `Gradient descent is the engine that makes neural networks learn. Here's the intuition.

## The Hiking Analogy

Imagine you're on a mountain, blindfolded, trying to reach the lowest valley. You feel the slope under your feet (the **gradient**) and take a step downhill. Repeat until you're at the bottom.

## The Math

\`\`\`
θ_new = θ_old - learning_rate × ∇L(θ)
\`\`\`

- **θ** = model parameters (weights)
- **L** = loss function
- **∇L** = gradient (direction of steepest increase)
- **learning_rate** = step size

## Why It Works

Backpropagation computes ∇L efficiently using the chain rule — it propagates the error from the output layer back through every layer to the input, computing gradients for each weight along the way.

## Common Pitfalls

1. **Learning rate too high** → overshooting, loss bounces
2. **Learning rate too low** → painfully slow convergence
3. **Vanishing gradients** → deep networks stop learning in early layers

Would you like to see how Adam optimizer improves on vanilla gradient descent?`,
  },
  {
    keywords: ['rag', 'retrieval', 'embedding', 'vector', 'vector store'],
    response: `RAG (Retrieval-Augmented Generation) is how we give LLMs access to external knowledge. Here's the full picture.

## How It Works

1. **Chunk** your documents into ~512-token pieces
2. **Embed** each chunk into a vector using an embedding model
3. **Store** vectors in a vector database (Pinecone, pgvector, etc.)
4. At query time, **embed the question** and find the closest chunks
5. **Feed those chunks** into the LLM prompt as context

\`\`\`python
# Simplified RAG pipeline
question = "What is attention?"
query_embedding = embed(question)
relevant_chunks = vector_db.search(query_embedding, top_k=5)
answer = llm.generate(prompt=f"Context: {relevant_chunks}\\nQuestion: {question}")
\`\`\`

## Key Tuning Knobs

| Parameter | Effect |
|-----------|--------|
| Chunk size | Smaller = more precise, less context |
| Overlap | Prevents splitting ideas across chunks |
| Top-k | More results = broader but noisier context |

Want me to help you design an eval set for your RAG pipeline?`,
  },
  {
    keywords: ['sql', 'join', 'query', 'select', 'group by', 'window function'],
    response: `Let's make SQL click. Here are the patterns that matter most.

## JOINs

\`\`\`sql
-- INNER JOIN: only matching rows
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id;

-- LEFT JOIN: all users, even those without orders
SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
\`\`\`

## Window Functions

\`\`\`sql
-- Rank each user's orders by amount
SELECT
  user_id,
  total,
  RANK() OVER (PARTITION BY user_id ORDER BY total DESC) as rank
FROM orders;
\`\`\`

> **Window vs GROUP BY:** GROUP BY collapses rows into one per group. Window functions keep all rows but add a computed value *across* the group.

Ready for a practice query challenge?`,
  },
  {
    keywords: ['react', 'component', 'hook', 'usestate', 'useeffect', 'jsx'],
    response: `React is all about building UIs from reusable pieces. Let me clarify the core concepts.

## Components

A component is just a function that returns JSX:

\`\`\`tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>
}
\`\`\`

## Hooks

**useState** — add state to a component:
\`\`\`tsx
const [count, setCount] = useState(0)
// <button onClick={() => setCount(count + 1)}>Count: {count}</button>
\`\`\`

**useEffect** — run side effects (fetching, subscriptions):
\`\`\`tsx
useEffect(() => {
  fetch('/api/data').then(setData)
}, []) // empty deps = run once on mount
\`\`\`

## The Mental Model

React re-renders when state or props change. Each render is a snapshot — the JSX you return describes what the UI should look like *now*. React reconciles the difference and updates the DOM efficiently.

Want to build something together to practice?`,
  },
  {
    keywords: ['interview', 'job', 'career', 'resume', 'prepare'],
    response: `Let's get you interview-ready. Here's a structured plan.

## 1. Fundamentals First

Make sure you can explain these cold:
- **Data structures:** arrays, hash maps, trees, graphs
- **Algorithms:** binary search, BFS/DFS, dynamic programming
- **System design:** caching, load balancing, databases

## 2. Practice Strategy

- Start with **easy** LeetCode problems (50-100)
- Move to **medium** (focus on patterns, not memorization)
- Do **2-3 mock interviews** per week

## 3. Behavioral Prep

Use the **STAR** framework:
- **S**ituation — set the scene
- **T**ask — what was your responsibility
- **A**ction — what *you* did
- **R**esult — measurable outcome

> **Pro tip:** Interviewers care more about your problem-solving *process* than the final answer. Think out loud.

Want to do a mock interview right now? I can ask you a question and evaluate your answer.`,
  },
  {
    keywords: ['machine learning', 'ml', 'model', 'train', 'training', 'overfitting', 'bias variance'],
    response: `Let's build your ML intuition from the ground up.

## The Core Loop

Every ML model learns by:
1. **Make a prediction** on training data
2. **Measure the error** (loss function)
3. **Adjust weights** to reduce error (gradient descent)
4. **Repeat** until convergence

## Overfitting vs Underfitting

| Problem | Symptom | Fix |
|---------|---------|-----|
| **Underfitting** | High training error | More complex model, more features |
| **Overfitting** | Low train, high test error | Regularization, more data, dropout |

## The Bias-Variance Tradeoff

- **High bias** → oversimplified model (underfitting)
- **High variance** → model memorizes noise (overfitting)
- The sweet spot minimizes *both*

\`\`\`python
# Regularization in action
from sklearn.linear_model import Ridge
model = Ridge(alpha=1.0)  # L2 regularization
model.fit(X_train, y_train)
\`\`\`

Want to dive deeper into any of these, or shall we work through a practical example?`,
  },
  {
    keywords: ['prompt', 'prompting', 'llm', 'gpt', 'chatgpt', 'ai'],
    response: `Prompt engineering is the art of talking to LLMs effectively. Here are the techniques that actually work.

## 1. Be Specific and Structured

❌ "Write code for a website"
✅ "Write a React component that renders a login form with email and password fields, using Tailwind CSS for styling"

## 2. Few-Shot Examples

\`\`\`
Classify the sentiment:
Text: "I love this!" → Positive
Text: "Terrible experience" → Negative
Text: "It was okay" → Neutral
Text: "Best purchase ever" → ?
\`\`\`

## 3. Chain-of-Thought

Ask the model to reason step-by-step:
> "Think through this problem step by step before giving your final answer."

## 4. Structured Output

\`\`\`
Respond in JSON format:
{"summary": "...", "sentiment": "positive|negative|neutral", "confidence": 0.0-1.0}
\`\`\`

> **Key insight:** LLMs are pattern matchers. The more structure and examples you provide, the more reliable the output.

Want to practice crafting prompts for a specific use case?`,
  },
  {
    keywords: ['hello', 'hi', 'hey', 'start', 'help'],
    response: `Hello! I'm your **Akademia AI Coach** — here to help you learn faster and deeper.

I can help you with:

- 📚 **Explaining concepts** — from Python basics to transformer architecture
- 🧠 **Debugging code** — paste your code and I'll find the issue
- 🎯 **Practice problems** — I'll generate exercises tailored to your level
- 🗣️ **Mock interviews** — technical interview practice with feedback
- 📈 **Learning paths** — I'll suggest what to learn next

What would you like to explore today?`,
  },
];

const fallbackResponse = `That's a great topic! Let me help you think through this.

Here's how I'd approach it:

1. **Break it down** — identify the core concepts involved
2. **Start simple** — understand the fundamentals before adding complexity
3. **Practice** — apply the concept with a hands-on example
4. **Reflect** — what worked? What surprised you?

> I'm a learning-focused AI coach, so I'll always try to guide you toward understanding rather than just giving answers. The best learning happens when you struggle a little first!

Could you tell me more about what you're trying to learn? For example:
- Are you working through a specific course?
- Preparing for an interview?
- Debugging something in your code?

The more context you give me, the better I can tailor my help.`;

export function generateResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  for (const rule of responseRules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.response;
    }
  }
  return fallbackResponse;
}

export function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40).trim() + '…';
}

export const suggestedPrompts = [
  {
    title: 'Explain attention',
    prompt: 'Can you explain how attention works in transformers?',
    icon: 'brain',
  },
  {
    title: 'Debug my code',
    prompt: 'Help me debug a gradient descent implementation that is not converging',
    icon: 'bug',
  },
  {
    title: 'Practice interview',
    prompt: 'Give me a mock machine learning interview question',
    icon: 'message',
  },
  {
    title: 'Learn Python',
    prompt: 'Teach me Python list comprehensions with examples',
    icon: 'code',
  },
];
