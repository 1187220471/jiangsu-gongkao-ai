import test from 'node:test'
import assert from 'node:assert/strict'
import {
  splitShenlunPaper,
  cleanQuestionText,
  splitMaterials,
  extractMaterialRefs,
} from './shenlunPaperSplit'

// fixture 1：标准分行卷
const STANDARD = `给定资料1
近年来，江苏省持续推进基层治理现代化，取得了明显成效。各地在实践中探索出不少好做法，值得总结推广。
给定资料2
与此同时，一些地方仍然存在服务供给不足、群众参与度不高等问题，需要引起重视。
作答要求
1. 根据给定资料1，概括江苏省基层治理的主要做法。（20分）不超过250字
2. 结合给定资料2，谈谈你对"服务供给不足"的理解。（15分）不超过300字
3. 请结合给定资料，以"基层治理"为主题，写一篇文章。（35分）1000字左右`

// fixture 2：数字版 PDF，正文几乎无换行
const NO_NEWLINE =
  '给定资料1近年来，江苏省持续推进基层治理现代化，取得了明显成效。给定资料2与此同时，一些地方仍然存在服务供给不足的情况。作答要求 1.根据给定资料1，概括江苏省的主要做法。（20分）不超过250字 2.结合给定资料2，谈谈你的理解。（15分）不超过300字'

// fixture 3：OCR 错字 + 页码 + 重复页眉 + 全角括号题号
const OCR_NOISY = `江苏省考申论模拟卷
江苏省考申论模拟卷
江苏省考申论模拟卷
1
给定资料1
近年来，江苏省持续推进基层治理现代化，各地探索出不少好做法，值得总结推广。
2
给定资料2
与此同时，一些地方仍然存在服务供给不足、群众参与度不高等情况，需要引起重视并加以解决。
作答要求
（1）根据给定资料1，概括江苏省基层治理的主要做法。（20分）不超过250字
（2）结合给定资料2，谈谈你对服务供给的理解。（15分）不超过300字`

test('标准分行卷：切出 3 题，题型/分值/字数正确', () => {
  const r = splitShenlunPaper(STANDARD)
  assert.equal(r.questions.length, 3)
  assert.deepEqual(
    r.questions.map((q) => q.questionNumber),
    [1, 2, 3]
  )
  assert.equal(r.questions[0].questionType, '归纳概括')
  assert.equal(r.questions[0].score, 20)
  assert.equal(r.questions[0].wordLimit, '不超过250字')
  assert.equal(r.questions[1].questionType, '综合分析')
  assert.equal(r.questions[1].wordLimit, '不超过300字')
  assert.equal(r.questions[2].questionType, '大作文')
  assert.equal(r.questions[2].score, 35)
  assert.equal(r.questions[2].wordLimit, '1000字左右')
  assert.ok(r.materialsText.includes('给定资料1'))
  assert.ok(!r.materialsText.includes('作答要求'))
  assert.equal(r.warnings.length, 0)
})

test('无换行数字版：仍能切出 2 题', () => {
  const r = splitShenlunPaper(NO_NEWLINE)
  assert.equal(r.questions.length, 2)
  assert.deepEqual(
    r.questions.map((q) => q.questionNumber),
    [1, 2]
  )
  assert.ok(r.materialsText.includes('给定资料1'))
})

test('OCR 噪声：页码与重复页眉被清理，全角括号题号可识别', () => {
  const r = splitShenlunPaper(OCR_NOISY)
  assert.equal(r.questions.length, 2)
  assert.deepEqual(
    r.questions.map((q) => q.questionNumber),
    [1, 2]
  )
  assert.ok(!r.materialsText.includes('江苏省考申论模拟卷'))
  assert.equal(r.questions[0].questionType, '归纳概括')
  assert.equal(r.questions[1].questionType, '综合分析')
})

test('无作答要求：按题号切分并给出 warning', () => {
  const r = splitShenlunPaper(
    '给定资料1\n某县推进基层治理，形成了可复制的经验做法。\n1. 请概括该县的主要做法。（20分）不超过250字\n2. 请谈谈你的理解。（15分）不超过300字'
  )
  assert.equal(r.questions.length, 2)
  assert.ok(r.warnings.some((w) => w.includes('作答要求')))
  assert.ok(r.materialsText.length > 0)
})

test('空文本：返回空结果', () => {
  const r = splitShenlunPaper('   ')
  assert.equal(r.questions.length, 0)
  assert.equal(r.materialsText, '')
  assert.ok(r.warnings.length > 0)
})

test('题干清洗：去掉分值与字数要求，保留正文', () => {
  const cleaned = cleanQuestionText(
    '根据给定资料1，概括江苏省基层治理的主要做法。（20分）不超过250字'
  )
  assert.ok(cleaned.includes('概括江苏省基层治理的主要做法'))
  assert.ok(cleaned.includes('给定资料1'))
  assert.ok(!cleaned.includes('20分'))
  assert.ok(!cleaned.includes('250字'))
})

test('材料分块：按「给定资料N」切分', () => {
  const blocks = splitMaterials(
    '给定资料1\n近年来江苏省推进基层治理，形成了不少可复制的经验。\n给定资料2\n与此同时，部分地区仍存在服务供给不足等问题。'
  )
  assert.equal(blocks.length, 2)
  assert.deepEqual(
    blocks.map((b) => b.num),
    ['1', '2']
  )
  assert.ok(blocks[0].content.includes('基层治理'))
})

test('材料分块：无标题时回退为单块「全文」', () => {
  const blocks = splitMaterials('这是一段没有编号的连续材料，内容足够长，用于测试回退逻辑是否生效。')
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].num, '全文')
})

test('材料引用：解析单个、区间与并列', () => {
  assert.deepEqual(extractMaterialRefs('根据给定资料2，概括做法', ['1', '2', '3']), ['2'])
  assert.deepEqual(extractMaterialRefs('结合给定资料1-3，谈谈理解', ['1', '2', '3', '4']), [
    '1',
    '2',
    '3',
  ])
  assert.deepEqual(extractMaterialRefs('参考资料2、4，提出对策', ['1', '2', '3', '4']), ['2', '4'])
  assert.deepEqual(extractMaterialRefs('请结合材料，写一篇文章', ['1', '2']), [])
})

test('作答要求中的 (1)(2)(3) 不应被误判为题号', () => {
  const r = splitShenlunPaper(`给定资料1
某县推进文旅融合，形成了可复制的经验做法，带动了当地经济发展和群众增收。
作答要求
一、请概括该县的主要做法。（20分）要求：全面准确。篇幅不超过250字。
二、请围绕"文旅融合"写一篇文章。（40分）要求：(1)自选角度，自拟标题；(2)参考给定资料；(3)观点明确；(4)篇幅1000字左右。`)

  assert.equal(r.questions.length, 2)
  assert.ok(r.questions[1].questionText.includes('自选角度'))
  assert.ok(r.questions[1].questionText.includes('观点明确'))
  assert.ok(!r.questions[1].questionText.includes('篇幅'))
  assert.ok(!r.questions[0].questionText.endsWith('篇幅'))
  assert.equal(r.questions[1].wordLimit, '1000字左右')
})
