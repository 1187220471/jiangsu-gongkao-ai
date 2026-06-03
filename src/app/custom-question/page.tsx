'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'
import VoiceInput from '@/components/VoiceInput'
import AudioUploader from '@/components/AudioUploader'

export default function CustomQuestion() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [userAnswer, setUserAnswer] = useState('')
  const [referenceAnswer, setReferenceAnswer] = useState('')
  const [evaluation, setEvaluation] = useState('')
  const [improvedAnswer, setImprovedAnswer] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'question' | 'answer' | 'result'>('question')
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const voicePreviewRef = useRef<HTMLDivElement>(null)

  // 语音预览框自动滚动到底部
  useEffect(() => {
    if (voicePreviewRef.current) {
      voicePreviewRef.current.scrollTop = voicePreviewRef.current.scrollHeight
    }
  }, [userAnswer])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    }
  }, [router])

  const handleNext = () => {
    if (!question.trim() || question.trim().length < 10) {
      alert('请输入完整的面试题目，至少10个字')
      return
    }
    setStep('answer')
  }

  const handleGenerateAnswer = async () => {
    if (!question) return

    setLoading(true)
    try {
      const res = await fetch('/api/answers/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question }),
      })

      const data = await res.json()
      if (data.answer) {
        setReferenceAnswer(data.answer)
      } else {
        alert(data.error || '生成答案失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleEvaluate = async () => {
    if (!userAnswer.trim()) {
      alert('请先输入你的答案')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          question,
          referenceAnswer,
          userAnswer,
          type: 'custom',
        }),
      })

      const data = await res.json()
      if (data.evaluation) {
        setEvaluation(data.evaluation)
        setScore(data.score)
        setImprovedAnswer(data.improvedAnswer || '')
        // 如果后端同时返回了参考答案，自动设置（不额外消耗次数）
        if (data.referenceAnswer) {
          setReferenceAnswer(data.referenceAnswer)
        }
        setStep('result')
      } else {
        alert(data.error || '批改失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleNewQuestion = () => {
    setStep('question')
    setQuestion('')
    setUserAnswer('')
    setReferenceAnswer('')
    setEvaluation('')
    setImprovedAnswer('')
    setScore(null)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-800"
          >
            <span className="text-2xl">🐻</span>
            <span className="font-bold">江苏公务员面试答题训练</span>
          </button>
          <div className="text-sm text-slate-500">
            {step === 'question' && '输入题目'}
            {step === 'answer' && '答题练习'}
            {step === 'result' && '批改结果'}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Input Question */}
        {step === 'question' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              输入你自己的面试题目
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              粘贴你收集到的面试真题或模拟题，输入题目后即可作答并获得AI批改。
            </p>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full h-48 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-slate-700 leading-relaxed"
              placeholder={`请在此输入面试题目...\n\n例如：\n某市推行「一网通办」政务服务改革，要求群众办事「最多跑一次」。但在实际执行中，部分群众反映仍存在材料重复提交、部门间信息不互通等问题。对此，你怎么看？`}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-slate-400">
                {question.length} 字
              </div>
              <button
                onClick={handleNext}
                disabled={loading || question.trim().length < 10}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step 2-3: Answer / Result */}
        {(step === 'answer' || step === 'result') && (
          <div>
            {/* Question Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  自定义题目
                </span>
                <span className="text-xs text-slate-400">用户输入</span>
              </div>
              <div className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                {question}
              </div>
            </div>

            {/* Reference Answer */}
            {referenceAnswer && (
              <div className="bg-green-50 rounded-xl border border-green-200 p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✅</span>
                  <h3 className="font-bold text-green-800">参考答案</h3>
                </div>
                <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {referenceAnswer}
                </div>
              </div>
            )}

            {/* User Answer Input (answer step only) */}
            {step === 'answer' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800">你的答案</h3>
                  <div className="flex items-center gap-2">
                    <AudioUploader
                      onTranscript={(text) => setUserAnswer((prev) => prev + text)}
                      disabled={loading}
                    />
                    <VoiceInput
                      onTranscript={(text) => setUserAnswer((prev) => prev + text)}
                      disabled={loading}
                      onRecordingChange={setIsVoiceRecording}
                    />
                  </div>
                </div>
                {/* 语音实时转写预览 */}
                {isVoiceRecording && (
                  <div
                    ref={voicePreviewRef}
                    className="w-1/2 ml-auto mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm text-slate-700"
                    style={{ height: 48, overflowY: 'hidden', overflowX: 'hidden', wordBreak: 'break-all' }}
                  >
                    {userAnswer || '等待语音识别...'}
                  </div>
                )}
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full h-64 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-slate-700 leading-relaxed"
                  placeholder="请在此输入你的面试答案，或点击右上角语音答题..."
                />
                <div className="text-right text-sm text-slate-400 mt-2">
                  {userAnswer.length} 字
                </div>
              </div>
            )}

            {/* Evaluation Result (result step only) */}
            {step === 'result' && (
              <>
                {/* Score Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📊</span>
                      <h3 className="font-bold text-slate-800">AI批改结果</h3>
                    </div>
                    {score !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">得分：</span>
                        <span
                          className={`text-2xl font-bold ${
                            score >= 80
                              ? 'text-green-600'
                              : score >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {score}
                        </span>
                        <span className="text-slate-400">/100</span>
                      </div>
                    )}
                  </div>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {evaluation}
                  </div>
                </div>

                {/* Improved Answer */}
                {improvedAnswer && (
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">✨</span>
                      <h3 className="font-bold text-blue-800">改进版答案（基于你的答案优化）</h3>
                    </div>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {improvedAnswer}
                    </div>
                  </div>
                )}

                {/* User Original Answer */}
                {userAnswer && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 mb-6">
                    <h3 className="font-bold text-slate-700 mb-3">你的原始答案</h3>
                    <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {userAnswer}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              {/* Answer step: two main buttons */}
              {step === 'answer' && (
                <>
                  <button
                    onClick={handleEvaluate}
                    disabled={loading}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading ? '批改中...' : '提交批改'}
                  </button>
                  <button
                    onClick={handleGenerateAnswer}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading ? '生成中...' : '👀 生成参考答案'}
                  </button>
                  <button
                    onClick={() => setStep('question')}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-6 py-2.5 rounded-xl transition-colors"
                  >
                    修改题目
                  </button>
                </>
              )}

              {/* Result step */}
              {step === 'result' && (
                <>
                  <button
                    onClick={handleNewQuestion}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
                  >
                    再来一题
                  </button>
                  {!referenceAnswer && (
                    <button
                      onClick={handleGenerateAnswer}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {loading ? '生成中...' : '查看参考答案'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
