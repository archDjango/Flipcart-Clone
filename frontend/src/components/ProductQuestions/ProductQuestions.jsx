import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import './ProductQuestions.css';

const ProductQuestions = ({ productId }) => {
  const { user, role, permissions } = useContext(AuthContext);
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswers, setNewAnswers] = useState({});
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch questions and answers
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        console.log(`Fetching questions for product ID: ${productId}`);
        const response = await axios.get(`http://localhost:5000/api/questions/${productId}`);
        console.log('Questions fetched:', response.data);
        setQuestions(response.data);
        setError('');
      } catch (err) {
        console.error('Fetch questions error:', {
          message: err.message,
          code: err.code,
          status: err.response?.status,
          response: err.response?.data
        });
        setError('Failed to load questions: ' + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [productId]);

  // Handle question submission
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to ask a question.');
      return;
    }
    if (!newQuestion.trim()) {
      setError('Question cannot be empty.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/products/${productId}/questions`,
        { text: newQuestion },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestions([...questions, response.data]);
      setNewQuestion('');
      setError('');
    } catch (err) {
      console.error('Ask question error:', err);
      setError('Failed to submit question: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired. Please log in again.');
      }
    }
  };

  // Handle answer submission
  const handleAnswerSubmit = async (questionId) => {
    if (!user) {
      setError('Please log in to answer a question.');
      return;
    }
    const answerText = newAnswers[questionId]?.trim();
    if (!answerText) {
      setError('Answer cannot be empty.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/questions/${questionId}/answers`,
        { text: answerText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestions(
        questions.map((q) =>
          q.id === questionId ? { ...q, answers: [...(q.answers || []), response.data] } : q
        )
      );
      setNewAnswers({ ...newAnswers, [questionId]: '' });
      setError('');
    } catch (err) {
      console.error('Submit answer error:', err);
      setError('Failed to submit answer: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired. Please log in again.');
      }
    }
  };

  // Handle upvote/downvote
  const handleVote = async (answerId, voteType) => {
    if (!user) {
      setError('Please log in to vote.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/answers/${answerId}/vote`,
        { vote_type: voteType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestions(
        questions.map((q) => ({
          ...q,
          answers: (q.answers || []).map((a) =>
            a.id === answerId
              ? { ...a, upvotes: response.data.upvotes, downvotes: response.data.downvotes }
              : a
          ),
        }))
      );
      setError('');
    } catch (err) {
      console.error('Vote error:', err);
      setError('Failed to vote: ' + (err.response?.data?.message || err.message));
    }
  };

  // Handle marking an answer as most helpful
  const handleMarkHelpful = async (questionId, answerId) => {
    if (!user || !['admin', 'manager'].includes(role) || !permissions?.moderation?.edit) {
      setError('You do not have permission to mark answers as helpful.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/answers/${answerId}/mark-helpful`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestions(
        questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                answers: (q.answers || []).map((a) => ({
                  ...a,
                  is_most_helpful: a.id === answerId ? true : false,
                })),
              }
            : q
        )
      );
      setError('');
    } catch (err) {
      console.error('Mark helpful error:', err);
      setError('Failed to mark answer: ' + (err.response?.data?.message || err.message));
    }
  };

  // Handle flagging content
  const handleFlag = async (contentType, contentId, reason) => {
    if (!user) {
      setError('Please log in to flag content.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/questions/${contentType === 'question' ? contentId : questions.find(q => q.answers.some(a => a.id === contentId)).id}/flag`,
        { content_type: contentType, content_id: contentId, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setError('');
      alert('Content flagged for moderation.');
    } catch (err) {
      console.error('Flag error:', err);
      setError('Failed to flag content: ' + (err.response?.data?.message || err.message));
    }
  };

  // Handle moderation (approve/remove)
  const handleModerate = async (contentType, contentId, action) => {
    if (!user || !['admin', 'manager'].includes(role) || !permissions?.moderation?.edit) {
      setError('You do not have permission to moderate content.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/moderation/${contentType}/${contentId}`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (action === 'remove') {
        if (contentType === 'question') {
          setQuestions(questions.filter((q) => q.id !== contentId));
        } else {
          setQuestions(
            questions.map((q) => ({
              ...q,
              answers: (q.answers || []).filter((a) => a.id !== contentId),
            }))
          );
        }
      }
      setError('');
      alert(`Content ${action}d successfully.`);
    } catch (err) {
      console.error('Moderate error:', err);
      setError('Failed to moderate content: ' + (err.response?.data?.message || err.message));
    }
  };

  // Toggle question expansion
  const toggleQuestion = (questionId) => {
    setExpandedQuestions((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  if (loading) return <div className="loading">Loading questions...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="product-questions-container">
      <h2>Product Questions</h2>

      {/* Ask a Question Form */}
      {user && (
        <form onSubmit={handleAskQuestion} className="ask-question-form">
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ask a question about this product..."
            rows="4"
            required
          />
          <button type="submit">Ask Question</button>
        </form>
      )}

      {/* Questions List */}
      <div className="questions-list">
        {questions.length === 0 ? (
          <p>No questions yet. Be the first to ask!</p>
        ) : (
          questions.map((question) => (
            <div key={question.id} className="question-item">
              <div className="question-header" onClick={() => toggleQuestion(question.id)}>
                <h3>{question.text}</h3>
                <span className="toggle-icon">{expandedQuestions[question.id] ? '−' : '+'}</span>
              </div>
              <p className="question-meta">
                Asked by {question.username} on {new Date(question.created_at).toLocaleDateString()}
                {user && (
                  <button
                    className="flag-btn"
                    onClick={() => handleFlag('question', question.id, 'Inappropriate content')}
                  >
                    Flag
                  </button>
                )}
                {['admin', 'manager'].includes(role) && permissions?.moderation?.edit && (
                  <>
                    <button
                      className="moderate-btn"
                      onClick={() => handleModerate('question', question.id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      className="moderate-btn"
                      onClick={() => handleModerate('question', question.id, 'remove')}
                    >
                      Remove
                    </button>
                  </>
                )}
              </p>
              {expandedQuestions[question.id] && (
                <div className="answers-section">
                  {question.answers?.length > 0 ? (
                    question.answers.map((answer) => (
                      <div key={answer.id} className="answer-item">
                        <p>{answer.text}</p>
                        <p className="answer-meta">
                          Answered by {answer.username} on{' '}
                          {new Date(answer.created_at).toLocaleDateString()}
                          {answer.is_most_helpful && <span className="most-helpful">Most Helpful</span>}
                        </p>
                        <div className="vote-buttons">
                          <button onClick={() => handleVote(answer.id, 'upvote')}>
                            👍 {answer.upvotes || 0}
                          </button>
                          <button onClick={() => handleVote(answer.id, 'downvote')}>
                            👎 {answer.downvotes || 0}
                          </button>
                          {['admin', 'manager'].includes(role) && permissions?.moderation?.edit && (
                            <button
                              className="mark-helpful-btn"
                              onClick={() => handleMarkHelpful(question.id, answer.id)}
                            >
                              Mark as Most Helpful
                            </button>
                          )}
                          {user && (
                            <button
                              className="flag-btn"
                              onClick={() =>
                                handleFlag('answer', answer.id, 'Inappropriate content')
                              }
                            >
                              Flag
                            </button>
                          )}
                          {['admin', 'manager'].includes(role) && permissions?.moderation?.edit && (
                            <>
                              <button
                                className="moderate-btn"
                                onClick={() => handleModerate('answer', answer.id, 'approve')}
                              >
                                Approve
                              </button>
                              <button
                                className="moderate-btn"
                                onClick={() => handleModerate('answer', answer.id, 'remove')}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No answers yet.</p>
                  )}
                  {user && (
                    <div className="answer-form">
                      <textarea
                        value={newAnswers[question.id] || ''}
                        onChange={(e) =>
                          setNewAnswers({ ...newAnswers, [question.id]: e.target.value })
                        }
                        placeholder="Your answer..."
                        rows="3"
                      />
                      <button onClick={() => handleAnswerSubmit(question.id)}>Submit Answer</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProductQuestions;