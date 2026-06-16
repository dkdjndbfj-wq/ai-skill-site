// ============================================
// AI 技能站 - 自动发送邮件通知
// 邮件内容 = 今天文章的完整正文
// ============================================

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2e086b97-0621-4c96-8074-d8e62c5ce9f6';
const SITE_URL = 'https://dkdjndbfj-wq.github.io/ai-skill-site';
const ARTICLES_DIR = 'C:\\Users\\24230\\Desktop\\ai-articles';

function log(msg) {
  console.log(`[${new Date().toLocaleString('zh-CN')}] ${msg}`);
}

function getToday() {
  const d = new Date();
  return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
}

// 从 HTML 中提取文章正文为纯文本
function extractArticleBody(html) {
  // 先提取 <div class="wrap"> 中的正文
  let body = html;
  const wrapMatch = html.match(/<div class="wrap">([\s\S]*?)<\/div>\s*<div class="footer">/i);
  if (wrapMatch) body = wrapMatch[1];
  
  // 去掉 header、footer、style、script、nav
  body = body.replace(/<header[\s\S]*?<\/header>/gi, '');
  body = body.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');
  body = body.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  // 去掉返回链接
  body = body.replace(/<a[^>]*>.*?返回.*?<\/a>/gi, '');
  // 去掉底部导航
  body = body.replace(/<div class="nav-bottom">[\s\S]*?<\/div>/gi, '');
  // 去掉页面标题后缀
  body = body.replace(/ - AI 技能站/g, '');
  
  // h1 -> 大标题
  body = body.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n══════════════════\n★ $1\n══════════════════\n');
  // h2 -> 中标题
  body = body.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n━━━━━━━━━━━━━━━━\n◆ $1\n━━━━━━━━━━━━━━━━\n');
  // h3 -> 小标题
  body = body.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n▸ $1\n');
  // h4
  body = body.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n▸ $1\n');
  // li -> 列表项
  body = body.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '  • $1\n');
  // p -> 段落
  body = body.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n');
  // br -> 换行
  body = body.replace(/<br\s*\/?>/gi, '\n');
  // strong/b -> 加粗标记
  body = body.replace(/<(strong|b)>([\s\S]*?)<\/(strong|b)>/gi, '【$2】');
  // a -> 保留链接文字
  body = body.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  // code
  body = body.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  // 去掉其他 HTML 标签
  body = body.replace(/<[^>]+>/g, '');
  // 解码 HTML 实体
  body = body.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // 清理多余空行
  body = body.replace(/\n{3,}/g, '\n\n');
  body = body.trim();
  return body;
}

// 获取今天新生成的文章（含完整内容）
function getTodaysArticles() {
  const today = new Date().toISOString().split('T')[0];
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => {
    if (!f.endsWith('.html')) return false;
    const stat = fs.statSync(path.join(ARTICLES_DIR, f));
    const fileDate = stat.mtime.toISOString().split('T')[0];
    return fileDate === today;
  });

  return files.map(f => {
    const html = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf8');
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : f;
    const body = extractArticleBody(html);
    const url = SITE_URL + '/ai-articles/' + encodeURIComponent(f);
    return { title, body, url, filename: f };
  });
}

// 构建邮件正文（包含所有文章的完整内容）
function buildEmailBody(articles) {
  const today = getToday();
  
  let emailBody = '';
  emailBody += '🤖 AI 技能站日报 - ' + today + '\n';
  emailBody += '═'.repeat(30) + '\n\n';
  emailBody += '今天为你精选了 ' + articles.length + 篇 AI 前沿内容，以下是完整正文：\n\n';
  
  articles.forEach((article, i) => {
    emailBody += '\n' + '─'.repeat(30) + '\n';
    emailBody += '📰 文章 ' + (i + 1) + '/' + articles.length + '\n';
    emailBody += '─'.repeat(30) + '\n\n';
    emailBody += article.body + '\n\n';
    emailBody += '🔗 在线阅读: ' + article.url + '\n';
  });
  
  emailBody += '\n' + '═'.repeat(30) + '\n';
  emailBody += '💡 AI 技能站每天自动采集 GitHub、36氪、量子位、少数派等权威来源的最新 AI 资讯。\n\n';
  emailBody += '🌐 访问网站查看更多: ' + SITE_URL + '\n';
  emailBody += '📮 如需退订，请点击邮件底部的退订链接。\n\n';
  emailBody += 'AI 技能站 · Made with 🤖';
  
  return emailBody;
}

// 通过 Buttondown API 发送邮件
async function sendNewsletter(articles) {
  const today = getToday();
  const subject = '🤖 AI 技能站日报 - ' + today + ' | ' + articles.length + 篇精选';
  const body = buildEmailBody(articles);

  const postData = JSON.stringify({
    subject: subject,
    body: body,
    status: 'about_to_send'
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.buttondown.com',
      path: '/v1/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + API_KEY,
        'Content-Type': 'application/json; charset=utf-8',
        'X-Buttondown-Live-Dangerously': 'true',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error('API Error ' + res.statusCode + ': ' + data.substring(0, 300)));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 主流程
async function main() {
  log('开始发送邮件通知...');

  const articles = getTodaysArticles();
  if (articles.length === 0) {
    log('今天没有新文章，跳过发送');
    return;
  }

  log('发现 ' + articles.length + ' 篇新文章：');
  articles.forEach(a => log('  - ' + a.title));

  // 检查订阅者
  const subsRes = await new Promise((resolve) => {
    https.get({
      hostname: 'api.buttondown.com',
      path: '/v1/subscribers',
      headers: { 'Authorization': 'Token ' + API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ count: 0, results: [] }); }
      });
    }).on('error', () => resolve({ count: 0, results: [] }));
  });

  const activeSubs = (subsRes.results || []).filter(s => s.type === 'regular' || s.type === 'unactivated');
  if (activeSubs.length === 0) {
    log('暂无订阅者，跳过发送（文章已发布到网站）');
    return;
  }

  log('活跃订阅者: ' + activeSubs.length + ' 人');

  try {
    const result = await sendNewsletter(articles);
    log('✅ 邮件已发送！ID: ' + result.id);
    log('📧 邮件包含 ' + articles.length + 篇文章的完整正文');
  } catch (e) {
    log('❌ 发送失败: ' + e.message);
    if (e.message.includes('disabled')) {
      log('💡 提示: Buttondown 账户正在审核中，请登录 https://buttondown.com/home 完成审核');
    }
  }
}

main().catch(e => log('错误: ' + e.message));