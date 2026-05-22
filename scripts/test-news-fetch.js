/**
 * 江苏政务新闻抓取 + AI过滤精选 测试脚本
 * 用法: node scripts/test-news-fetch.js
 * 配置: 在项目根目录 .env 文件中设置 DEEPSEEK_API_KEY
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

// 从URL或HTML中尝试提取日期
function extractDate(url, html) {
  // 策略1：从URL中提取日期模式（如 t20260522_ 或 /202605/）
  const urlPatterns = [
    /t(\d{4})(\d{2})(\d{2})_/,           // t20260522_
    /\/(\d{4})(\d{2})\//,                // /202605/
    /\/(\d{4})-(\d{2})-(\d{2})\//,       // /2026-05-22/
    /\/(\d{4})\/(\d{2})(\d{2})\//,       // /2026/0522/
  ];
  for (const p of urlPatterns) {
    const m = url.match(p);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  // 策略2：从HTML片段中找日期
  const htmlPatterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})\/(\d{2})\/(\d{2})/,
    /(\d{2})-(\d{2})/,  // 05-22（假设今年）
  ];
  for (const p of htmlPatterns) {
    const m = html.match(p);
    if (m) {
      if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`;
      // 只有月-日，补今年
      const year = new Date().getFullYear();
      return `${year}-${m[1]}-${m[2]}`;
    }
  }
  // 策略3：默认今天
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

const SITES = [
  {
    name: '江苏省人民政府网',
    url: 'https://www.jiangsu.gov.cn/',
    encoding: 'utf-8',
    extract: (html) => {
      const results = [];
      const regex = /<a[^>]*href="([^"]*\/art\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi;
      let match;
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1];
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https://www.jiangsu.gov.cn' + url,
          source: '江苏省人民政府网',
          type: 'policy',
          date: extractDate(url, ''),
        });
      }
      return results;
    },
  },
  {
    name: '中共江苏省委新闻网',
    url: 'http://www.zgjssw.gov.cn/',
    encoding: 'utf-8',
    extract: (html) => {
      const results = [];
      const regex = /<a[^>]*href="([^"]*(?:yaowen|fabuting|zhiduhuibian)[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi;
      let match;
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1];
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'http://www.zgjssw.gov.cn' + url,
          source: '中共江苏省委新闻网',
          type: 'party',
          date: extractDate(url, ''),
        });
      }
      return results;
    },
  },
  {
    name: '中国江苏网',
    url: 'https://jsnews.jschina.com.cn/jsyw/',
    encoding: 'utf-8',
    extract: (html) => {
      const results = [];
      const regex = /<a[^>]*href="([^"]*\/jsyw\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi;
      let match;
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1];
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https:' + url,
          source: '中国江苏网',
          type: 'media',
          date: extractDate(url, html),
        });
      }
      return results;
    },
  },
  {
    name: '新华报业网',
    url: 'https://www.xhby.net/xjiangsu',
    encoding: 'utf-8',
    extract: (html) => {
      const results = [];
      const regex = /<div class="article-li"[^>]*>[\s\S]*?<a[^>]*href="([^"]*\/content\/s[0-9a-z]+\.html)"[^>]*>[\s\S]*?<div class="title">([^<]{10,80})<\/div>/gi;
      let match;
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1];
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https:' + url,
          source: '新华报业网',
          type: 'media',
          date: extractDate(url, html),
        });
      }
      return results;
    },
  },
  {
    name: '中国新闻网|江苏',
    url: 'https://www.js.chinanews.com.cn/',
    encoding: 'gb2312',
    extract: (html) => {
      const results = [];
      // 尝试匹配带时间的新闻条目
      const regex = /<a[^>]*href="([^"]*\/news\/[^"]*)"[^>]*>([^<]{10,80})<\/a>[\s\S]*?<span[^>]*>(\d{4}-\d{2}-\d{2}[\s\d:]*)<\/span>/gi;
      let match;
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1];
        const dateStr = match[3] ? match[3].trim().split(' ')[0] : extractDate(url, html);
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https://www.js.chinanews.com.cn' + url,
          source: '中国新闻网|江苏',
          type: 'media',
          date: dateStr,
        });
      }
      // 如果没匹配到带时间的，再用简单正则
      if (results.length === 0) {
        const simpleRegex = /<a[^>]*href="([^"]*\/news\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi;
        while ((match = simpleRegex.exec(html)) && results.length < 15) {
          const url = match[1];
          results.push({
            title: match[2].replace(/<[^>]+>/g, '').trim(),
            url: url.startsWith('http') ? url : 'https://www.js.chinanews.com.cn' + url,
            source: '中国新闻网|江苏',
            type: 'media',
            date: extractDate(url, html),
          });
        }
      }
      return results;
    },
  },
  {
    name: '扬子晚报网',
    url: 'https://www.yzwb.net/',
    encoding: 'utf-8',
    extract: (html) => {
      const results = [];
      // 尝试匹配带时间的新闻
      const regex = /<a[^>]*href="([^"]*\/news\/[^"]*)"[^>]*>([^<]{10,80})<\/a>[\s\S]*?(\d{4}-\d{2}-\d{2}[\s\d:]*)/gi;
      let match;
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1];
        const dateStr = match[3] ? match[3].trim().split(' ')[0] : extractDate(url, html);
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https://www.yzwb.net' + url,
          source: '扬子晚报网',
          type: 'media',
          date: dateStr,
        });
      }
      // 备选
      if (results.length === 0) {
        const simpleRegex = /<a[^>]*href="([^"]*\/news\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi;
        while ((match = simpleRegex.exec(html)) && results.length < 15) {
          const url = match[1];
          results.push({
            title: match[2].replace(/<[^>]+>/g, '').trim(),
            url: url.startsWith('http') ? url : 'https://www.yzwb.net' + url,
            source: '扬子晚报网',
            type: 'media',
            date: extractDate(url, html),
          });
        }
      }
      return results;
    },
  },
];

async function fetchSite(site) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(site.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { site: site.name, error: `HTTP ${response.status}`, results: [] };
    }

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder(site.encoding || 'utf-8').decode(buffer);
    const results = site.extract(html);

    return { site: site.name, results, count: results.length };
  } catch (err) {
    return { site: site.name, error: err.message, results: [] };
  }
}

async function aiFilter(newsItems, apiKey) {
  if (!apiKey) {
    console.log('\n⚠️ 未设置 API Key，跳过 AI 过滤，仅展示原始抓取结果\n');
    return null;
  }

  const prompt = `你是一位资深公考备考资料编辑，负责从以下江苏地区新闻中筛选出对公务员申论写作和结构化面试最有参考价值的新闻，并精选出今日最重要的消息。

## 第一步：评分筛选

筛选标准（严格按此执行，与公考备考价值直接挂钩）：

1. **申论/面试话题相关度**（权重40%）：
   - 高分领域：民生保障（教育、医疗、养老、住房、就业）、产业创新（新质生产力、数字经济、先进制造）、经济发展（营商环境、消费升级、外贸外资）、文化繁荣（文旅融合、非遗保护、公共文化）、社会治理（基层治理、数字化治理、乡村振兴）、科技创新（成果转化、人才政策）、绿色发展（生态保护、碳达峰碳中和）、区域协调（长三角一体化、城乡融合）
   - 这些话题是申论和面试的高频考点，必须优先保留

2. **政策重要性**（权重25%）：对江苏省发展有重大影响、涉及全省层面的制度安排或战略部署

3. **时效性**（权重20%）：最新发布、紧迫性强、反映当前热点

4. **信息密度**（权重15%）：内容具体、有数据支撑、有做法经验、有制度创新，而非空泛口号

**分值调整规则**（在基础分上直接加减）：
- 纯人事任免（如"关于XX等职务任免的通知""省管干部任职前公示"）：基础分 -3
- 含政策背景的人事变动（如"新任领导推进某项改革"）：不扣分，按政策内容评分
- 征地批复、地价标准等纯行政事务：基础分 -1
- 民生保障类：基础分 +1
- 产业创新/经济发展类：基础分 +1
- 文化繁荣/文旅融合类：基础分 +1
- 基层治理/乡村振兴类：基础分 +1
- 长三角一体化/科技创新类：基础分 +1

**排除项**（直接过滤）：
- 娱乐八卦、体育赛事、明星动态
- 纯商业广告、企业产品推广
- 社会猎奇、情感故事
- 天气预报、生活服务、交通提示
- 重复报道（同一事件只保留最早/最权威来源）
- 纯会议报道无实质内容

请对每条新闻进行评分（0-10分），给出判断理由。

## 第二步：精选"今日要闻"

从评分≥6分的新闻中，**精选8-12条**作为"今日最重要的消息"。

精选原则：
- 优先选分数最高的
- 兼顾话题多样性（不全是经济类或民生类，尽量覆盖不同考点）
- 优先选有具体数据、具体做法的新闻
- 同一件事只选一条（最权威来源）

## 第三步：为每条精选新闻写简介

对每条"今日要闻"，撰写一段 **50-100字** 的简介。

简介要求：
- 概括新闻核心内容（什么事、谁做的、什么意义）
- 点明与申论/面试哪个话题相关
- 若有具体数据（如金额、数量、百分比），必须包含
- 语言简洁，不要空话套话
- 字数严格控制在50-100字之间

---

## 输出格式

### 今日精选（8-12条）

请按以下格式输出，**必须包含每条新闻的时间**：

**【主题分类】** 民生保障（或产业创新/经济发展/文化繁荣/社会治理/科技创新/区域协调等）

**【标题】** 新闻标题
**【时间】** YYYY-MM-DD
**【来源】** 来源网站
**【分数】** X分
**【简介】** 50-100字简介，说明核心内容、政策意义、关联的申论/面试话题

（同一主题下的多条新闻连续列出，然后换下一个主题）

---

新闻列表（共${newsItems.length}条）：
${newsItems.map((n, i) => `${i + 1}. [${n.date}] [${n.source}] ${n.title}`).join('\n')}`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('AI过滤失败:', err.message);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  江苏政务新闻抓取 + AI过滤精选 测试');
  console.log('='.repeat(60));
  console.log(`  时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DASHSCOPE_API_KEY;

  // 1. 抓取所有网站
  console.log('📡 开始抓取新闻...\n');
  const results = await Promise.all(SITES.map(fetchSite));

  let allNews = [];
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.site}: ${r.error}`);
    } else {
      console.log(`✅ ${r.site}: 抓取到 ${r.count} 条`);
      allNews = allNews.concat(r.results);
    }
  }

  console.log(`\n📊 原始抓取总计: ${allNews.length} 条新闻`);

  // 去重（按标题相似度）
  const seen = new Set();
  const uniqueNews = allNews.filter(n => {
    const key = n.title.slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`📊 去重后: ${uniqueNews.length} 条\n`);

  // 2. AI过滤
  const filtered = await aiFilter(uniqueNews, apiKey);

  if (!filtered) {
    // 未设置Key，展示原始结果
    console.log('📰 原始抓取结果（前30条）：\n');
    uniqueNews.slice(0, 30).forEach((n, i) => {
      console.log(`${i + 1}. [${n.source}] ${n.title}`);
    });
    console.log('\n💡 提示: 设置 API Key 后可启用 AI 过滤精选');
    console.log('   运行: DEEPSEEK_API_KEY=your-key node scripts/test-news-fetch.js');
  } else {
    console.log('\n🤖 AI 过滤精选结果:\n');
    console.log(filtered);
  }

  console.log('\n' + '='.repeat(60));
}

main();
