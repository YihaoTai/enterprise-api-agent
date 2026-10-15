/**
 * Prompt builder for LLM
 * Constructs prompts for AI Mock generation
 */
import { Injectable } from '@nestjs/common';
import { JsonSchema } from './json-schema.inferencer';
import { SemanticAnalysisResult } from '../services/field-semantic-analyzer';

/**
 * Field semantic mapping rules
 */
const SEMANTIC_MAPPINGS: Record<string, string> = {
  // Contact
  phone: '11位手机号',
  mobile: '11位手机号',
  tel: '手机号或固定电话',
  email: '邮箱地址',
  mail: '邮箱地址',

  // Person
  person_name: '中文姓名',
  first_name: '中文名',
  last_name: '中文姓',
  username: '用户名（英文或中文，3-15字符）',
  nickname: '昵称',
  age: '年龄（18-100的整数）',
  gender: '性别（男/女）',
  sex: '性别（男/女）',
  avatar: '头像URL',
  image: '图片URL',
  photo: '图片URL',

  // Boolean fields - 常见命名模式
  isActive: '布尔值（true/false）',
  isVerified: '布尔值（true/false）',
  isEnabled: '布尔值（true/false）',
  isDeleted: '布尔值（true/false）',
  isLocked: '布尔值（true/false）',
  isAdmin: '布尔值（true/false）',
  isPremium: '布尔值（true/false）',

  // Level and tags
  level: '等级（1-100的整数）',
  rank: '等级（1-100的整数）',
  vip: '等级（1-10的整数）',
  tags: '标签数组（中文标签如"VIP"、"活跃"）',
  hobbies: '爱好数组（中文词汇如"篮球"、"读书"）',
  interests: '兴趣数组（中文词汇）',
  skills: '技能数组（中文词汇）',
  preferences: '偏好数组（中文词汇）',

  // Score
  score: '分数（0-100的整数）',
  scores: '分数数组（0-100的整数）',
  rating: '评分（1-5的浮点数）',
  points: '积分（整数）',
  balance: '余额（数字）',

  // Location
  address: '完整地址',
  city: '城市名',
  country: '国家名',
  province: '省份',
  state: '省份',
  district: '区县（如"朝阳区"、"西湖区"）',
  street: '街道路名（如"光华路"、"科技园路"）',
  zipcode: '邮政编码',
  postal_code: '邮政编码',

  // Money
  amount: '金额',
  price: '价格',
  cost: '成本价',
  discount: '折扣比例',
  salary: '薪资',
  income: '收入',

  // Number
  count: '数量',
  number: '数字',
  num: '数量',
  total: '总数',

  // ID
  id: 'ID（数字或字符串）',
  uuid: 'UUID格式',
  token: '随机token',
  key: '唯一键',
  secret: '密钥',

  // Content
  description: '描述文本',
  desc: '描述文本',
  content: '内容文本',
  name: '名称',
  title: '标题',
  headline: '标题',
  summary: '摘要',

  // Status
  status: '状态值',
  type: '类型',
  role: '角色（admin/user/guest等）',

  // Time
  timestamp: '时间戳（数字）',
  time: '时间（HH:mm:ss格式）',
  date: '日期（yyyy-MM-dd格式）',
  datetime: '日期时间',
  birthday: '生日',
  birth: '生日',
  createTime: '创建时间',
  updateTime: '更新时间',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  expireTime: '过期时间',
  expireAt: '过期时间',

  // Security
  password: '密码',
};

/**
 * 中文随机值生成规则
 */
const CHINESE_RULES = {
  // 百家姓前100个姓氏
  surnames: '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史汤唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅卞齐康伍余元卜顾孟平黄和穆萧尹姚邵舒屈项祝董梁',

  // 千字文部分常用字（用于名字）
  nameChars: '天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏云腾致雨露结为霜金生丽水玉出昆冈剑号巨阙珠称夜光果珍李柰菜羹曲台推让与立先先亡',
};

/**
 * 中国地级市列表（部分）
 */
const CITIES = [
  '北京', '上海', '天津', '重庆',
  '广州', '深圳', '珠海', '东莞', '佛山', '中山', '惠州', '汕头', '江门', '茂名', '湛江', '肇庆', '梅州', '汕尾', '河源', '阳江', '清远', '韶关', '揭阳', '潮州', '云浮',
  '杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水', '义乌', '余姚', '慈溪', '诸暨', '海宁', '桐乡', '临安', '永康', '东阳', '浦江',
  '南京', '苏州', '无锡', '常州', '南通', '扬州', '镇江', '泰州', '盐城', '淮安', '连云港', '徐州', '宿迁', '丹阳', '张家港', '常熟', '太仓', '江阴', '宜兴', '邳州', '新沂', '溧阳', '如皋', '启东', '海门', '东台', '高邮', '仪征', '扬中', '句容', '靖江', '兴化',
  '成都', '绵阳', '德阳', '宜宾', '泸州', '南充', '达州', '乐山', '内江', '遂宁', '广安', '资阳', '眉山', '雅安', '广元', '巴中', '攀枝花', '自贡', '甘孜', '阿坝', '凉山',
  '武汉', '襄阳', '宜昌', '荆州', '黄冈', '孝感', '荆门', '鄂州', '咸宁', '十堰', '随州', '恩施', '黄石', '仙桃', '潜江', '天门', '神农架',
  '西安', '咸阳', '宝鸡', '渭南', '榆林', '延安', '安康', '汉中', '商洛', '铜川', '韩城', '华阴', '兴平', '彬州', '子长', '定边', '府谷',
  '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西', '耒阳', '常宁', '醴陵', '湘乡', '韶山', '临湘', '汨罗', '临湘', '沅江', '资兴', '洪江', '冷水江', '涟源', '吉首',
  '郑州', '洛阳', '开封', '南阳', '新乡', '安阳', '焦作', '许昌', '平顶山', '商丘', '周口', '信阳', '驻马店', '濮阳', '三门峡', '漯河', '鹤壁', '济源', '巩义', '新郑', '新密', '登封', '荥阳', '偃师', '舞钢', '汝州', '林州', '义马', '灵宝', '卫辉', '辉县', '禹州', '长葛', '项城',
  '济南', '青岛', '烟台', '威海', '潍坊', '临沂', '济宁', '淄博', '泰安', '德州', '聊城', '滨州', '菏泽', '枣庄', '东营', '日照', '莱芜', '章丘', '胶州', '滕州', '龙口', '莱阳', '莱州', '蓬莱', '招远', '栖霞', '海阳', '青州', '诸城', '寿光', '安丘', '高密', '昌邑', '曲阜', '邹城', '新泰', '肥城', '荣成', '乳山', '文登', '临清', '乐陵', '禹城', '临邑', '平原', '武城', '夏津', '齐河', '惠民', '阳信', '无棣', '博兴', '邹平', '曹县', '单县', '成武', '巨野', '郓城', '鄄城', '定陶', '东明', '莱西', '平度', '即墨', '胶南', '崂山', '李沧', '城阳',
  '福州', '厦门', '泉州', '漳州', '莆田', '宁德', '三明', '南平', '龙岩', '晋江', '石狮', '南安', '福清', '长乐', '邵武', '武夷山', '建瓯', '建阳', '永安', '福安', '福鼎', '霞浦', '古田', '屏南', '寿宁', '周宁', '柘荣',
  '南昌', '景德镇', '九江', '赣州', '吉安', '宜春', '抚州', '上饶', '鹰潭', '新余', '萍乡', '瑞金', '共青城', '庐山', '南康', '丰城', '樟树', '高安', '德兴', '婺源', '弋阳', '铅山', '横峰', '广丰', '上饶县', '玉山', '万年', '余干', '鄱阳', '万载', '上高', '宜丰', '靖安', '铜鼓',
  '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城', '巢湖', '桐城', '天长', '明光', '界首', '宁国', '广德', '郎溪', '泾县', '绩溪', '旌德', '石台', '青阳', '东至', '固镇', '五河', '怀远', '凤台', '潘集', '毛集', '寿县', '霍山', '舒城', '金寨', '霍邱', '叶集', '裕安', '金安',
  '石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水', '武安', '南宫', '辛集', '深州', '晋州', '新乐', '鹿泉', '遵化', '迁安', '霸州', '三河', '泊头', '任丘', '黄骅', '河间', '涿州', '定州', '安国', '高碑店', '满城', '清苑', '徐水', '满城', '易县', '曲阳', '阜平', '定兴', '唐县', '顺平', '博野', '蠡县', '安新', '容城', '雄县', '张家口', '康保', '沽源', '尚义', '蔚县', '阳原', '怀安', '万全', '承德县', '兴隆', '平泉', '滦平', '隆化', '丰宁', '宽城', '围场', '青龙', '昌黎', '卢龙', '抚宁', '固安', '永清', '大城', '文安', '大厂', '枣强', '武邑', '武强', '饶阳', '安平', '故城', '景县', '阜城', '临西', '威县', '清河', '南宫', '新河', '巨鹿', '平乡', '广宗', '南和', '任县', '内丘', '临城', '隆尧', '柏乡', '宁晋', '赵县', '元氏', '高邑', '赞皇', '井陉', '平山', '行唐', '灵寿', '正定', '藁城', '栾城',
  '昆明', '曲靖', '玉溪', '大理', '丽江', '楚雄', '红河', '文山', '西双版纳', '德宏', '普洱', '保山', '昭通', '临沧', '怒江', '迪庆', '瑞丽', '芒市', '腾冲', '安宁', '宣威', '个旧', '开远', '蒙自', '弥勒', '建水', '石屏', '河口', '易门', '澄江', '通海', '华宁', '峨山', '新平', '元江', '禄丰', '武定', '元谋', '永仁', '牟定', '南华', '姚安', '大姚', '双柏', '禄劝', '寻甸', '嵩明', '晋宁', '富民', '宜良', '石林', '呈贡', '东川', '马关', '麻栗坡', '丘北', '砚山', '西畴', '广南', '富宁', '麻栗坡', '个旧', '绿春', '金平', '泸西', '弥勒', '石屏',
  '太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁', '古交', '潞城', '高平', '介休', '永济', '河津', '原平', '临汾', '侯马', '霍州', '汾阳', '孝义', '交口', '中阳', '交城', '文水', '岚县', '兴县', '临县', '柳林', '方山', '离石', '怀仁', '应县', '山阴', '右玉', '平鲁', '朔城', '浑源', '广灵', '灵丘', '阳高', '天镇', '左云', '大同', '新荣', '云州', '平定', '盂县', '郊区', '长子', '壶关', '黎城', '潞城', '屯留', '平顺', '襄垣', '沁源', '沁县', '武乡', '左权', '和顺', '昔阳', '寿阳', '太谷', '祁县', '平遥', '灵石', '介休', '榆社', '和顺', '左权',
  '长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边', '德惠', '榆树', '磐石', '蛟河', '桦甸', '舒兰', '梨树', '伊通', '双辽', '东丰', '东辽', '通化县', '辉南', '柳河', '梅河口', '集安', '抚松', '靖宇', '长白', '临江', '乾安', '长岭', '扶余', '前郭尔罗斯', '珲春', '图们', '敦化', '龙井', '和龙', '汪清', '安图',
  '沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛', '新民', '瓦房店', '庄河', '海城', '东港', '凤城', '凌海', '北镇', '盖州', '大石桥', '灯塔', '调兵山', '开原', '昌图', '北票', '凌源', '兴城', '绥中', '建平', '喀左', '朝阳县', '建昌', '彰武', '阜新县', '清原', '新宾', '本溪县', '桓仁', '宽甸', '岫岩', '新民',
  '哈尔滨', '齐齐哈尔', '牡丹江', '佳木斯', '大庆', '鸡西', '双鸭山', '伊春', '七台河', '鹤岗', '黑河', '绥化', '大兴安岭', '尚志', '五常', '宾县', '方正', '依兰', '巴彦', '木兰', '通河', '延寿', '尚志', '双城', '阿城', '呼兰', '阿城', '富裕', '拜泉', '克山', '克东', '龙江', '依安', '泰来', '甘南', '杜尔伯特', '林甸', '肇州', '肇源', '漠河', '呼玛', '塔河', '逊克', '孙吴', '北安', '五大连池', '嫩江', '绥棱', '海伦', '庆安', '望奎', '兰西', '青冈', '明水', '拜泉', '海伦',
  '呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安', '锡林郭勒', '阿拉善', '满洲里', '二连浩特', '根河', '额尔古纳', '扎兰屯', '牙克石', '阿尔山', '乌兰浩特', '科尔沁右翼前旗', '阿尔山', '突泉', '扎赉特旗', '科尔沁左翼中旗', '科尔沁左翼后旗', '开鲁', '库伦旗', '奈曼旗', '扎鲁特旗', '霍林郭勒', '多伦', '正蓝旗', '正镶白旗', '镶黄旗', '太仆寺旗', '西乌珠穆沁旗', '东乌珠穆沁旗', '苏尼特左旗', '苏尼特右旗', '阿巴嘎旗', '锡林浩特', '临河', '五原', '磴口', '杭锦后旗', '乌拉特前旗', '乌拉特中旗', '乌拉特后旗', '奈曼旗', '凉城', '卓资', '兴和', '商都', '化德', '察哈尔右翼前旗', '察哈尔右翼中旗', '察哈尔右翼后旗', '丰镇', '阿尔山',
  '银川', '石嘴山', '吴忠', '固原', '中卫', '灵武', '青铜峡', '平罗', '贺兰', '永宁', '同心', '盐池', '红寺堡', '原州', '西吉', '隆德', '泾源', '彭阳', '海原', '沙坡头', '中宁', '青铜峡',
  '西宁', '海东', '海北', '黄南', '海南', '果洛', '玉树', '海西', '格尔木', '德令哈', '茫崖', '玉树', '玛沁', '班玛', '甘德', '达日', '久治', '玛多', '杂多', '称多', '治多', '囊谦', '曲麻莱', '共和', '贵德', '贵南', '同德', '兴海', '刚察', '海晏', '祁连', '门源', '浩亹', '乐都', '民和', '互助', '化隆', '循化', '同仁', '尖扎', '泽库', '河南', '乌兰', '都兰', '天峻', '冷湖', '大柴旦', '茫崖', '石油',
  '拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里', '乃金', '南木林', '江孜', '定日', '萨迦', '拉孜', '昂仁', '谢通门', '白朗', '仁布', '康马', '定结', '仲巴', '亚东', '吉隆', '聂拉木', '萨嘎', '岗巴', '卡若', '左贡', '芒康', '洛隆', '边坝', '江达', '贡觉', '类乌齐', '丁青', '察雅', '八宿', '左贡', '巴宜', '米林', '朗县', '工布江达', '波密', '察隅', '墨脱', '桑耶', '扎囊', '贡嘎', '浪卡子', '琼结', '洛扎', '加查', '隆子', '错那', '措美', '曲松', '洛扎', '乃金', '安多', '申扎', '索县', '尼玛', '班戈', '巴青', '比如', '聂荣', '安多', '改则', '革吉', '日土', '噶尔', '普兰', '札达', '巴尔', '措勤',
  '乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '博尔塔拉', '巴音郭楞', '阿克苏', '克孜勒苏', '喀什', '和田', '伊犁', '塔城', '阿勒泰', '石河子', '阿拉尔', '图木舒克', '五家渠', '北屯', '铁门关', '双河', '可克达拉', '昆玉', '胡杨河', '新星', '白杨', '乌鲁木齐县', '达坂城', '米东', '阜康', '五彩湾', '呼图壁', '玛纳斯', '奇台', '吉木萨尔', '木垒', '阜康', '博乐', '精河', '温泉', '阿拉山口', '库尔勒', '轮台', '尉犁', '若羌', '且末', '焉耆', '和静', '和硕', '博湖', '库车', '沙雅', '新和', '拜城', '温宿', '阿瓦提', '柯坪', '阿克苏', '乌什', '阿合奇', '阿克陶', '阿图什', '乌恰', '喀什', '疏附', '疏勒', '英吉沙', '泽普', '莎车', '叶城', '麦盖提', '岳普湖', '伽师', '巴楚', '塔什库尔干', '和田', '和田县', '墨玉', '皮山', '洛浦', '策勒', '于田', '民丰', '伊犁', '伊宁', '奎屯', '霍尔果斯', '尼勒克', '新源', '巩留', '特克斯', '昭苏', '察布查尔', '塔城', '塔城', '乌苏', '沙湾', '额敏', '裕民', '和布克赛尔', '阿勒泰', '阿勒泰', '布尔津', '富蕴', '福海', '哈巴河', '青河', '吉木乃', '石河子', '阿拉尔', '图木舒克', '五家渠', '北屯',
  '香港', '澳门', '台北', '高雄', '台中', '新北', '桃园', '台南', '基隆', '新竹', '嘉义', '屏东', '宜兰', '花莲', '台东', '澎湖', '金门', '马祖',
];

@Injectable()
export class PromptBuilder {
  /**
   * Build prompt for LLM with optional semantic analysis context
   * @param schema JSON Schema
   * @param exampleJson Original example JSON
   * @param history History of previously generated values
   * @param semanticAnalysis Optional LLM-based semantic analysis result
   */
  build(
    schema: JsonSchema,
    exampleJson: string,
    history: Record<string, any>[] = [],
    semanticAnalysis?: SemanticAnalysisResult
  ): string {
    const fieldsDescription = this.buildFieldsDescription(schema);

    // 构建历史数据描述
    let historySection = '';
    if (history.length > 0) {
      historySection = `
## 历史生成记录（禁止使用这些值）
${history.map((h, i) => `${i + 1}. ${JSON.stringify(h)}`).join('\n')}
**重要：以上历史记录中的所有值都禁止再次使用，必须生成全新的不同值**`;
    }

    // 提取示例输入中的字段名和类型（递归处理嵌套结构）
    let inputStructure = '';
    try {
      const exampleObj = JSON.parse(exampleJson);
      inputStructure = `
## 输入数据结构
${this.extractFieldsWithTypes(exampleObj, '')}`;
    } catch {
      inputStructure = '';
    }

    // 构建 LLM 语义分析结果（如果提供）
    let semanticContext = '';
    if (semanticAnalysis && Object.keys(semanticAnalysis.fields).length > 0) {
      semanticContext = this.buildSemanticContext(semanticAnalysis);
    }

    return `你是 API Mock 数据生成器。根据以下 JSON Schema 生成随机 Mock 数据。

## 任务要求
1. **根据字段名和类型生成随机数据**，字段名决定了数据的语义
2. 只返回 JSON 对象，不要添加任何解释或 markdown 代码块标记
3. 必须严格按照原始字段名和数据类型生成
${history.length === 0 ? '4. **生成任何合理的随机数据**' : '4. **禁止重复，必须生成与历史记录完全不同的数据**'}
5. **强制要求：必须使用随机值生成，禁止使用固定值或重复值**

## 强制输出规范
1. **真实性**：所有字段的值必须符合真实世界逻辑。
2. **禁止项**：严禁生成包含”描述”、”示例”、”测试”、”占位符”、下划线+数字（如”_123”、”名称_456”）的值。
3. **布尔类型字段**：isActive、isVerified、isEnabled 等字段必须输出 true 或 false（不是字符串）。
4. **整数类型字段**：age、level、score 等字段必须输出数字（不是字符串）。
5. **数组类型字段**：hobbies、tags、scores 等字段输出数组，元素为真实值（如 [“篮球”, “读书”]、[“VIP”, “活跃”]）。
6. **地址类字段**：
   - street：必须为真实路名，如”光华路”、”科技园路”，不得包含数字编号或”描述”字样。
   - city：必须为真实城市名，如”北京”、”上海”，不得为”城市_01”。
   - district：必须为真实区县，如”朝阳区”、”西湖区”，不得为”区县_01”。
7. **字符串长度**：除手机号、邮箱等固定格式外，普通字符串长度应在 2-20 个字符之间。

## 正确输出示例
输入字段：id, username, email, age, isActive, isVerified, phone, address{province, city, district, street, zipCode}, hobbies, scores, createTime, updateTime, role, level, tags

正确输出：
{
  “id”: “1001”,
  “username”: “刘明”,
  “email”: “liuming@example.com”,
  “age”: 28,
  “isActive”: true,
  “isVerified”: true,
  “phone”: “13812345678”,
  “address”: {
    “province”: “广东”,
    “city”: “深圳”,
    “district”: “南山区”,
    “street”: “科技园南路”,
    “zipCode”: “518000”
  },
  “hobbies”: [“篮球”, “读书”],
  “scores”: [85, 92, 78],
  “createTime”: “09:15:00”,
  “updateTime”: “10:30:00”,
  “role”: “user”,
  “level”: 5,
  “tags”: [“VIP”, “活跃”]
}

错误输出（禁止）：
{
  “id”: “1002”,
  “username”: “张三”,
  “isActive”: “名称_123”,  // 错误：布尔类型不能是字符串
  “level”: “描述_456”,     // 错误：整数类型不能是字符串
  “tags”: [“示例_789”],    // 错误：数组元素不能是”描述_xxx”格式
  “street”: “测试_111”     // 错误：不能包含”测试_xxx”
}

## 中文随机值生成规则（必须遵守）
- **姓名字段**：姓氏从以下百家姓中随机选择：${CHINESE_RULES.surnames.slice(0, 50)}（任选一个），名字从常用汉字中随机选择1-2个字组合
- **城市字段**：从以下城市列表中随机选择一个：${CITIES.slice(0, 50).join('、')}...等${CITIES.length}个城市
- **省份字段**：从以下省份中随机选择：北京、上海、天津、重庆、广东、江苏、浙江、四川、湖北、湖南、河南、山东、河北、山西、陕西、辽宁、吉林、黑龙江、福建、江西、云南、贵州、甘肃、青海、台湾、香港、澳门
- **地址字段**：格式为「{省份}+{城市}+{区县}+{街道}+{门牌号}」，如「北京市朝阳区光华路123号」
- **手机号字段**：11位数字，以13x、14x、15x、16x、17x、18x、19x开头
- **邮箱字段**：格式为「{用户名}@{域名}」，用户名5-10位字母或数字

${historySection}

## 字段语义映射规则
${fieldsDescription}

${inputStructure}
${semanticContext}

## 输出要求
- 返回纯 JSON 对象
- 字段名保持与输入完全一致
- 数据类型保持一致`;
  }

  /**
   * Build semantic context section from LLM analysis result
   */
  private buildSemanticContext(semanticAnalysis: SemanticAnalysisResult): string {
    const lines: string[] = ['## LLM 语义分析结果（重要参考）'];
    lines.push('以下字段语义由大模型分析推断，请严格遵循：\n');

    for (const [fieldName, semantic] of Object.entries(semanticAnalysis.fields)) {
      lines.push(`### \`${fieldName}\``);
      lines.push(`- **含义**: ${semantic.meaning}`);
      lines.push(`- **格式**: ${semantic.format}`);
      lines.push(`- **约束**: ${semantic.constraint}`);
      lines.push(`- **生成规则**: ${semantic.generationRule}`);
      lines.push('');
    }

    lines.push('## 语义约束检查清单');
    lines.push('生成数据时请确保：');
    lines.push('1. 每个字段的值符合上述”格式”要求');
    lines.push('2. 满足”约束”条件（如 > 0、合法邮箱格式等）');
    lines.push('3. 使用”生成规则”生成自然、合理的数据');

    return lines.join('\n');
  }

  /**
   * Build fields description from schema
   * 递归处理嵌套结构
   */
  private buildFieldsDescription(schema: JsonSchema, indent: string = ''): string {
    const lines: string[] = [];

    for (const [fieldName, property] of Object.entries(schema.properties)) {
      const type = property.type;
      const description = (property as any).description;

      let desc = `${indent}- \`${fieldName}\`: ${type}`;
      if (description) {
        const example = SEMANTIC_MAPPINGS[description];
        desc += ` (${example || description})`;
      }

      lines.push(desc);

      // 递归处理嵌套对象
      if (type === 'object' && property.properties) {
        lines.push(this.buildFieldsDescription(property as JsonSchema, indent + '  '));
      }

      // 递归处理数组项
      if (type === 'array' && property.items) {
        const itemsType = (property.items as any).type;
        if (itemsType === 'object' && (property.items as any).properties) {
          lines.push(this.buildFieldsDescription(property.items as JsonSchema, indent + '  '));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 递归提取字段名和类型（用于输入数据结构展示）
   */
  private extractFieldsWithTypes(obj: any, prefix: string): string {
    const lines: string[] = [];
    const indent = prefix ? '  ' : '';

    if (obj === null || typeof obj !== 'object') {
      return '';
    }

    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        return this.extractFieldsWithTypes(obj[0], prefix) + ' (数组)';
      }
      return '';
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;

      if (value === null) {
        lines.push(`${indent}- ${fieldName}: null`);
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          const itemType = typeof value[0] === 'object' ? 'object' : typeof value[0];
          if (typeof value[0] === 'object' && value[0] !== null) {
            lines.push(`${indent}- ${fieldName}: array<object>`);
            lines.push(this.extractFieldsWithTypes(value[0], fieldName));
          } else {
            lines.push(`${indent}- ${fieldName}: ${itemType}[]`);
          }
        } else {
          lines.push(`${indent}- ${fieldName}: array`);
        }
      } else if (typeof value === 'object') {
        lines.push(`${indent}- ${fieldName}: object`);
        lines.push(this.extractFieldsWithTypes(value, fieldName));
      } else {
        const typeStr = typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value;
        lines.push(`${indent}- ${fieldName}: ${typeStr}`);
      }
    }

    return lines.join('\n');
  }
}

