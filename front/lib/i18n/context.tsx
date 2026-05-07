'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Locale = 'zh-CN' | 'zh-TW' | 'en-US'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-CN')

  useEffect(() => {
    // Load saved language preference
    try {
      const saved = localStorage.getItem('hbrain_settings')
      if (saved) {
        const settings = JSON.parse(saved)
        if (settings.language && ['zh-CN', 'zh-TW', 'en-US'].includes(settings.language)) {
          setLocaleState(settings.language as Locale)
        }
      }
    } catch {}
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    // Save to settings
    try {
      const saved = localStorage.getItem('hbrain_settings')
      const settings = saved ? JSON.parse(saved) : {}
      settings.language = newLocale
      localStorage.setItem('hbrain_settings', JSON.stringify(settings))
    } catch {}
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const translations = getTranslations(locale)
    let value = translations[key] || key

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v))
      })
    }

    return value
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

function getTranslations(locale: Locale): Record<string, string> {
  switch (locale) {
    case 'zh-TW':
      return zhTW
    case 'en-US':
      return enUS
    default:
      return zhCN
  }
}

const zhCN: Record<string, string> = {
  // Common
  'common.save': '保存',
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.search': '搜索',
  'common.loading': '加载中...',
  'common.noData': '暂无数据',
  'common.success': '成功',
  'common.failed': '失败',

  // Navigation
  'nav.dashboard': '仪表盘',
  'nav.knowledge': '知识库',
  'nav.graph': '知识图谱',
  'nav.users': '用户管理',
  'nav.roles': '角色管理',
  'nav.permissions': '权限管理',
  'nav.settings': '系统设置',
  'nav.profile': '个人资料',
  'nav.changePassword': '修改密码',

  // Dashboard
  'dashboard.title': '仪表盘',
  'dashboard.subtitle': '知识库与图谱概览',
  'dashboard.docOverview': '文档概览',
  'dashboard.graphOverview': '知识图谱概览',
  'dashboard.processingTasks': '处理任务',
  'dashboard.failedTasks': '失败任务',
  'dashboard.noProcessing': '暂无处理中的任务',
  'dashboard.noFailed': '暂无失败任务',
  'dashboard.totalDocs': '共 {count} 个文档，已完成 {completed} 个',
  'dashboard.graphStats': '共 {nodes} 个节点，{edges} 条关系',

  // Knowledge
  'knowledge.title': '知识库管理',
  'knowledge.subtitle': '上传和管理知识库文档，支持 PDF、Office、TXT、图片格式',
  'knowledge.upload': '上传文档',
  'knowledge.dragDrop': '拖拽文件到此处或点击上传',
  'knowledge.supportedFormats': '支持 PDF、Word、PPT、Excel、图片等格式',
  'knowledge.status': '状态',
  'knowledge.format': '格式',
  'knowledge.allStatus': '全部状态',
  'knowledge.allFormat': '全部格式',
  'knowledge.completed': '已完成',
  'knowledge.parsing': '解析中',
  'knowledge.extracting': '提取中',
  'knowledge.uploading': '上传中',
  'knowledge.failed': '失败',

  // Graph
  'graph.title': '知识图谱',
  'graph.subtitle': '可视化展示实体关系网络，共 {nodes} 个节点、{edges} 条关系',
  'graph.search': '搜索节点或本质描述...',
  'graph.retrieval': '检索测试',
  'graph.retrievalTitle': '智能问答',
  'graph.inputQuestion': '输入问题，例如：如何提升团队效率？',
  'graph.startRetrieval': '开始检索',
  'graph.answer': '回答',
  'graph.matchedEntities': '匹配实体',
  'graph.evidence': '相关证据',

  // Settings
  'settings.title': '系统设置',
  'settings.subtitle': '管理您的账户和系统偏好设置',
  'settings.appearance': '外观设置',
  'settings.theme': '主题模式',
  'settings.themeDesc': '选择浅色或深色主题',
  'settings.light': '浅色',
  'settings.dark': '深色',
  'settings.system': '跟随系统',
  'settings.notifications': '通知设置',
  'settings.browserNotifications': '浏览器通知',
  'settings.browserNotificationsDesc': '接收文档处理完成、失败等浏览器推送通知',
  'settings.language': '显示语言',
  'settings.languageDesc': '选择界面显示语言',
  'settings.security': '安全设置',
  'settings.twoFactor': '双因素认证',
  'settings.twoFactorDesc': '使用手机验证码进行二次验证',
  'settings.autoLogout': '自动登出',
  'settings.autoLogoutDesc': '长时间未操作自动登出',
  'settings.saveSettings': '保存设置',
  'settings.saving': '保存中...',
  'settings.saved': '设置已保存',
  'settings.saveFailed': '保存失败',

  // Auth
  'auth.login': '登录',
  'auth.register': '注册',
  'auth.logout': '退出登录',
  'auth.username': '用户名',
  'auth.password': '密码',
  'auth.email': '邮箱',
  'auth.forgotPassword': '忘记密码？',
  'auth.noAccount': '还没有账号？',
  'auth.hasAccount': '已有账号？',
  'auth.loginSuccess': '登录成功',
  'auth.loginFailed': '登录失败',
  'auth.registerSuccess': '注册成功',
  'auth.registerFailed': '注册失败',

  // Sidebar
  'sidebar.brand': '管理后台',
  'sidebar.lightMode': '浅色模式',
  'sidebar.darkMode': '深色模式',

  // Notification
  'notification.docCompleted': '文档处理完成',
  'notification.docCompletedDesc': '已成功解析并加入知识图谱',
  'notification.docFailed': '文档处理失败',
  'notification.docFailedDesc': '解析失败',
  'notification.title': '通知',
  'notification.markAllRead': '全部已读',
  'notification.empty': '暂无通知',

  // Dashboard extended
  'dashboard.docOverviewDesc': '共 {count} 个文档，已完成 {completed} 个',
  'dashboard.docOverview': '文档概览',
  'dashboard.graphOverview': '知识图谱概览',
  'dashboard.noDocuments': '暂无文档',
  'dashboard.graphOverviewDesc': '共 {nodes} 个节点，{edges} 条关系',
  'dashboard.noGraphData': '暂无图谱数据',
  'dashboard.processingTasksDesc': '当前正在进行的文档处理任务',
  'dashboard.noProcessingTasks': '暂无处理中的任务',
  'dashboard.failedTasksDesc': '需要关注的失败任务',
  'dashboard.noFailedTasks': '暂无失败任务',
  'dashboard.uploadedAt': '上传于',

  // Stats
  'stat.total': '总文档数',
  'stat.completed': '已完成',
  'stat.processing': '处理中',
  'stat.failed': '失败',

  // Card
  'card.docList': '文档列表',

  // Label extended
  'label.filename': '文件名',
  'label.size': '大小',
  'label.uploadTime': '上传时间',
  'label.errorMessage': '错误信息',
  'label.processing': '正在处理中，请稍候...',

  // Table extended
  'table.noDocuments': '暂无文档',

  // Node types
  'nodeType.document': '文档',
  'nodeType.agent': '主体',
  'nodeType.object': '对象',
  'nodeType.concept': '概念',
  'nodeType.event': '事件',
  'nodeType.activity': '活动',
  'nodeType.rule': '规则',
  'nodeType.metric': '指标',
  'nodeType.time': '时间',
  'nodeType.location': '地点',
  'nodeType.statement': '陈述',
  'nodeType.issue': '问题',
  'nodeType.image': '图片',

  // Edge types
  'edgeType.mentions': '提及',
  'edgeType.defines': '定义',
  'edgeType.describes': '描述',
  'edgeType.part_of': '属于',
  'edgeType.contains': '包含',
  'edgeType.belongs_to': '归属于',
  'edgeType.responsible_for': '负责',
  'edgeType.performs': '执行',
  'edgeType.uses': '使用',
  'edgeType.creates': '创建',
  'edgeType.requires': '需要',
  'edgeType.prohibits': '禁止',
  'edgeType.permits': '允许',
  'edgeType.depends_on': '依赖于',
  'edgeType.causes': '导致',
  'edgeType.affects': '影响',
  'edgeType.mitigates': '缓解',
  'edgeType.measures': '度量',
  'edgeType.attribute': '属性',
  'edgeType.evidence_for': '证据支持',
  'edgeType.contradicts': '矛盾',
  'edgeType.derived_from': '源自',

  // Knowledge extended
  'knowledge.imageFile': '图片文件',
  'knowledge.imageFileDesc': '图片暂无解析内容，请下载查看',
  'knowledge.noContent': '暂无内容',
  'knowledge.processingLog': '处理日志',
  'knowledge.uploadFile': '上传知识文件',
  'knowledge.dropFiles': '释放文件以上传',
  'knowledge.dragHere': '拖拽文件到此处',
  'knowledge.orClickToSelect': '或点击选择文件，支持 PDF、Office、TXT、图片格式',
  'knowledge.uploadFileTab': '上传文件',
  'knowledge.pasteTextTab': '粘贴文本',
  'knowledge.textTitle': '标题',
  'knowledge.textTitlePlaceholder': '输入标题，如：用户问答记录',
  'knowledge.textContent': '文本内容',
  'knowledge.textContentPlaceholder': '粘贴或输入文本内容...',
  'knowledge.convertToWiki': '自动转换为百科格式',
  'knowledge.convertToWikiDesc': '使用AI将文本结构化为维基百科风格的文档',
  'knowledge.submitText': '提交文本',
  'knowledge.textSubmitted': '文本已提交',
  'knowledge.enterTitle': '请输入标题',
  'knowledge.enterContent': '请输入文本内容',

  // Filter
  'filter.text': '文本片段',

  // Graph extended
  'graph.feynmanSummary': '费曼总结',
  'graph.previewImage': '预览图片',
  'graph.confidence': '置信度',
  'graph.relations': '关联关系',
  'graph.sourceDocuments': '来源文档',
  'graph.relationTypes': '关系类型',
  'graph.retrievalTest': '检索测试',
  'graph.problemArchetype': '问题原型',
  'graph.matchedEntities': '匹配实体',
  'graph.relatedEvidence': '相关证据',
  'graph.inputQuestionPlaceholder': '输入问题，例如：如何提升团队效率？',
  'graph.emptyGraph': '暂无图谱数据，请先导入文档',
  'graph.emptyRetrieval': '输入问题开始检索',
  'graph.emptyRetrievalDesc': '基于知识图谱的智能问答',
  'graph.evidenceFullText': '全文证据',
  'graph.evidenceParagraph': '段落证据',
  'graph.evidenceSummary': '总结证据',
  'graph.mergeScan': '合并扫描',
  'graph.mergeScanning': '正在扫描重复实体...',
  'graph.mergeCandidates': '疑似重复实体',
  'graph.mergeNoCandidates': '未发现疑似重复实体',
  'graph.mergeReason': '判定原因',
  'graph.mergeConfidence': '相似度',
  'graph.mergePreview': '合并预览',
  'graph.mergeMergedLabel': '合并后标签',
  'graph.mergeMergedSummary': '合并后总结',
  'graph.mergeRelationsToMigrate': '待迁移关系',
  'graph.mergeConflicts': '冲突关系',
  'graph.mergeConfirm': '确认合并',
  'graph.mergeReject': '跳过',
  'graph.mergeSuccess': '合并成功，已迁移 {relations} 条关系',
  'graph.mergeFailed': '合并失败',
  'graph.mergeSelfLoop': '组内关系（将被删除）',
  'graph.mergeNoScan': '点击扫描按钮查找重复实体',

  // Users
  'users.title': '用户管理',
  'users.subtitle': '管理系统中的所有用户账户',
  'users.createUser': '新建用户',
  'users.userList': '用户列表',
  'users.userCount': '共 {count} 个用户',
  'users.userInfo': '用户信息',
  'users.phone': '手机号',
  'users.lastLogin': '最后登录',
  'users.userUpdated': '用户更新成功',
  'users.userCreated': '用户创建成功',
  'users.userDeleted': '用户删除成功',

  // Roles
  'roles.title': '角色管理',
  'roles.subtitle': '管理系统中的用户角色及权限分配',
  'roles.createRole': '新建角色',
  'roles.totalRoles': '总角色数',
  'roles.totalRoleUsers': '角色用户总数',
  'roles.totalPermissions': '权限总数',
  'roles.roleList': '角色列表',
  'roles.roleCount': '共 {count} 个角色',
  'roles.roleName': '角色名称',
  'roles.roleCode': '角色标识',
  'roles.userCount': '用户数',
  'roles.permissionCount': '权限数',
  'roles.allPermissions': '全部权限',
  'roles.enabled': '启用',
  'roles.disabled': '禁用',
  'roles.configurePermissions': '配置权限',
  'roles.roleUpdated': '角色更新成功',
  'roles.roleCreated': '角色创建成功',
  'roles.roleDeleted': '角色删除成功',
  'roles.permissionsSaved': '权限配置已保存',
  'roles.person': '人',

  // Permissions
  'permissions.title': '权限管理',
  'permissions.subtitle': '查看和管理系统中的所有权限配置',
  'permissions.totalPermissions': '总权限数',
  'permissions.menuPermissions': '菜单权限',
  'permissions.buttonPermissions': '按钮权限',
  'permissions.apiPermissions': 'API权限',
  'permissions.permissionList': '权限列表',
  'permissions.permissionListDesc': '按模块分类查看所有权限',
  'permissions.permissionName': '权限名称',
  'permissions.permissionCode': '权限标识',
  'permissions.module': '所属模块',
  'permissions.type': '类型',
  'permissions.menu': '菜单',
  'permissions.button': '按钮',
  'permissions.permissionStructure': '权限结构',
  'permissions.permissionStructureDesc': '各模块权限分布概览',
  'permissions.item': '项',
  'permissions.more': '更多...',

  // Login
  'login.welcome': '欢迎回来',
  'login.subtitle': '登录您的管理后台账号',
  'login.rememberMe': '记住我',
  'login.loggingIn': '登录中...',
  'login.noAccount': '还没有账号？',
  'login.registerNow': '立即注册',

  // Register
  'register.createAccount': '创建账号',
  'register.subtitle': '注册一个新的管理后台账号',
  'register.agreeTo': '我已阅读并同意',
  'register.termsOfService': '用户协议',
  'register.privacyPolicy': '隐私政策',
  'register.registering': '注册中...',
  'register.hasAccount': '已有账号？',
  'register.loginNow': '立即登录',

  // Profile
  'profile.title': '个人资料',
  'profile.subtitle': '管理您的个人信息',
  'profile.administrator': '管理员',
  'profile.editProfile': '编辑资料',
  'profile.editProfileDesc': '更新您的个人信息',
  'profile.accountInfo': '账户信息',
  'profile.userId': '用户ID',
  'profile.createdAt': '注册时间',
  'profile.accountStatus': '账号状态',
  'profile.normal': '正常',
  'profile.profileUpdated': '个人资料更新成功',

  // Change Password
  'changePassword.title': '修改密码',
  'changePassword.subtitle': '更新您的账户密码以保护账户安全',
  'changePassword.passwordSettings': '密码设置',
  'changePassword.passwordSettingsDesc': '请输入原密码并设置新密码',
  'changePassword.oldPassword': '原密码',
  'changePassword.newPassword': '新密码',
  'changePassword.confirmNewPassword': '确认新密码',
  'changePassword.passwordChanged': '密码修改成功',
  'changePassword.useNewPassword': '请使用新密码重新登录',
  'changePassword.securityTips': '安全提示',
  'changePassword.rotatePassword': '定期更换密码可以提高账户安全性',
  'changePassword.uniquePassword': '不要使用与其他网站相同的密码',
  'changePassword.complexPassword': '密码中包含大小写字母、数字和特殊字符更安全',
  'changePassword.keepSecret': '请勿将密码告知他人或保存在不安全的地方',
  'changePassword.weak': '弱',
  'changePassword.medium': '中等',
  'changePassword.strong': '强',
  'changePassword.ruleMinLength': '至少6个字符',
  'changePassword.ruleLowercase': '包含小写字母',
  'changePassword.ruleUppercase': '包含大写字母',
  'changePassword.ruleNumber': '包含数字',

  // Validation
  'validation.enterUsername': '请输入用户名',
  'validation.enterPassword': '请输入密码',
  'validation.usernameMin': '用户名至少2个字符',
  'validation.usernameMax': '用户名最多20个字符',
  'validation.usernameChars': '用户名只能包含字母、数字、下划线和中文',
  'validation.invalidEmail': '请输入有效的邮箱地址',
  'validation.passwordMin': '密码至少6个字符',
  'validation.passwordMax': '密码最多20个字符',
  'validation.passwordLowercase': '密码必须包含小写字母',
  'validation.passwordUppercase': '密码必须包含大写字母',
  'validation.passwordNumber': '密码必须包含数字',
  'validation.passwordSame': '新密码不能与原密码相同',
  'validation.passwordMismatch': '两次输入的密码不一致',
  'validation.agreeToTerms': '请阅读并同意用户协议',
  'validation.enterOldPassword': '请输入原密码',

  // Status
  'status.active': '活跃',
  'status.inactive': '未激活',
  'status.locked': '已锁定',
  'status.normal': '正常',
  'status.uploading': '上传中',
  'status.parsing': '解析中',
  'status.extracting': '抽取中',
  'status.completed': '已完成',
  'status.failed': '失败',

  // Action
  'action.upload': '上传文件',
  'action.retry': '重试',
  'action.download': '下载',
  'action.downloadFile': '下载文件',
  'action.edit': '编辑',
  'action.delete': '删除',
  'action.cancel': '取消',
  'action.createUser': '新建用户',
  'action.createRole': '新建角色',
  'action.configurePermissions': '配置权限',
  'action.retrievalTest': '检索测试',
  'action.saveChanges': '保存修改',
  'action.reset': '重置',
  'action.prev': '上一个',
  'action.next': '下一个',

  // Table
  'table.userInfo': '用户信息',
  'table.phone': '手机号',
  'table.roles': '角色',
  'table.status': '状态',
  'table.lastLogin': '最后登录',
  'table.actions': '操作',
  'table.roleName': '角色名称',
  'table.roleCode': '角色标识',
  'table.description': '描述',
  'table.userCount': '用户数',
  'table.permissionCount': '权限数',
  'table.permissionName': '权限名称',
  'table.permissionCode': '权限标识',
  'table.module': '所属模块',
  'table.type': '类型',
  'table.noData': '暂无数据',

  // Filter
  'filter.allStatus': '全部状态',
  'filter.allFormat': '全部格式',
  'filter.allTypes': '全部类型',
  'filter.all': '全部',

  // Label
  'label.status': '状态',
  'label.format': '格式',
  'label.username': '用户名',
  'label.email': '邮箱',
  'label.phone': '手机号',
  'label.password': '密码',
  'label.confirmPassword': '确认密码',
  'label.rememberMe': '记住我',
  'label.administrator': '管理员',
  'label.accountStatus': '账号状态',

  // Placeholder
  'placeholder.enterUsername': '请输入用户名',
  'placeholder.enterPassword': '请输入密码',
  'placeholder.enterEmail': '请输入邮箱',
  'placeholder.enterPhone': '请输入手机号',
  'placeholder.confirmPassword': '请再次输入密码',
  'placeholder.enterOldPassword': '请输入原密码',
  'placeholder.enterNewPassword': '请输入新密码',
  'placeholder.confirmNewPassword': '请再次输入新密码',
  'placeholder.enterPasswordHint': '请输入密码（至少6位）',
  'placeholder.searchDocuments': '搜索文档...',
  'placeholder.searchUsers': '搜索用户名或邮箱...',
  'placeholder.searchRoles': '搜索角色名称或标识...',
  'placeholder.searchPermissions': '搜索权限名称或标识...',

  // Dialog
  'dialog.confirmDelete': '确认删除',
  'dialog.confirmDeleteUser': '您确定要删除这个用户吗？此操作不可撤销。',
  'dialog.confirmDeleteRole': '您确定要删除这个角色吗？此操作不可撤销。',
  'dialog.confirmDeleteDoc': '确定要删除文档 "{name}" 吗？此操作无法撤销。',

  // Error
  'error.fetchUsersFailed': '获取用户列表失败',
  'error.fetchRolesFailed': '获取角色列表失败',
  'error.fetchPermissionsFailed': '获取权限列表失败',
  'error.operationFailed': '操作失败',
  'error.deleteFailed': '删除失败',
  'error.updateFailed': '更新失败',
  'error.saveFailed': '保存失败',
  'error.loginFailed': '登录失败',
  'error.registerFailed': '注册失败',
  'error.networkError': '网络错误，请稍后重试',
  'error.passwordChangeFailed': '密码修改失败',
  'error.loadGraphFailed': '加载图谱数据失败',
  'error.searchGraphFailed': '搜索图谱失败',
  'error.retrievalFailed': '知识检索失败，请稍后重试',
  'error.loadDocumentListFailed': '加载文档列表失败',
  'error.uploadFailed': '上传失败',
  'error.loadFileFailed': '加载文件失败',
  'error.loadFailed': '加载失败',

  // Success
  'success.loginSuccess': '登录成功',
  'success.redirecting': '正在跳转到管理后台...',
  'success.registerSuccess': '注册成功',
  'success.refreshed': '已刷新',

  // Unit
  'unit.person': '人',
  'unit.item': '项',

  // Upload
  'upload.dropFiles': '释放文件以上传',
  'upload.dragHere': '拖拽文件到此处',
  'upload.orClickToSelect': '或点击选择文件，支持 PDF、Office、TXT、图片格式',

  // Button
  'button.saving': '保存中...',
  'button.loggingIn': '登录中...',
  'button.registering': '注册中...',
  'button.login': '登录',
  'button.register': '注册',

  // Section
  'section.editProfile': '编辑资料',
  'section.editProfileDesc': '更新您的个人信息',
  'section.accountInfo': '账户信息',
  'section.passwordSettings': '密码设置',
  'section.passwordSettingsDesc': '请输入原密码并设置新密码',
  'section.securityTips': '安全提示',

  // Tip
  'tip.rotatePassword': '定期更换密码可以提高账户安全性',
  'tip.uniquePassword': '不要使用与其他网站相同的密码',
  'tip.complexPassword': '密码中包含大小写字母、数字和特殊字符更安全',
  'tip.keepSecret': '请勿将密码告知他人或保存在不安全的地方',

  // Link
  'link.forgotPassword': '忘记密码？',
  'link.registerNow': '立即注册',
  'link.loginNow': '立即登录',
  'link.termsOfService': '用户协议',
  'link.privacyPolicy': '隐私政策',

  // Search
  'search.placeholder': '搜索...',
  'search.graphPlaceholder': '搜索节点或本质描述...',

  // Action (additional)
  'action.save': '保存',

  // Placeholder (additional)
  'placeholder.selectStatus': '选择状态',

  // Validation (additional)
  'validation.roleRequired': '请至少选择一个角色',
  'validation.descMax': '描述最多200个字符',

  // Users (additional)
  'users.editUser': '编辑用户',
  'users.editUserDesc': '修改用户信息',
  'users.createUserDesc': '创建一个新的用户账户',
  'users.noAvailableRoles': '暂无可用角色，请先创建角色',

  // Label (additional)
  'label.phoneOptional': '手机号（可选）',
  'label.roles': '角色',
  'label.descriptionOptional': '描述（可选）',

  // Roles (additional)
  'roles.editRole': '编辑角色',
  'roles.editRoleDesc': '修改角色信息',
  'roles.createRoleDesc': '创建一个新的用户角色',
  'roles.enterRoleName': '请输入角色名称',
  'roles.roleCodePlaceholder': '例如：content_editor',
  'roles.enterRoleDesc': '请输入角色描述',
  'roles.nameMin': '角色名称至少2个字符',
  'roles.nameMax': '角色名称最多20个字符',
  'roles.codeMin': '角色标识至少2个字符',
  'roles.codeMax': '角色标识最多30个字符',
  'roles.codePattern': '角色标识只能包含小写字母和下划线',

  // Permissions (additional)
  'permissions.configurePermissions': '配置权限',
  'permissions.configForRole': '为角色 {name} 配置权限',
  'permissions.selectedCount': '已选择 {count} 项权限',
}

const zhTW: Record<string, string> = {
  // Common
  'common.save': '儲存',
  'common.cancel': '取消',
  'common.confirm': '確認',
  'common.delete': '刪除',
  'common.edit': '編輯',
  'common.search': '搜尋',
  'common.loading': '載入中...',
  'common.noData': '暫無資料',
  'common.success': '成功',
  'common.failed': '失敗',

  // Navigation
  'nav.dashboard': '儀錶板',
  'nav.knowledge': '知識庫',
  'nav.graph': '知識圖譜',
  'nav.users': '使用者管理',
  'nav.roles': '角色管理',
  'nav.permissions': '權限管理',
  'nav.settings': '系統設定',
  'nav.profile': '個人資料',
  'nav.changePassword': '修改密碼',

  // Dashboard
  'dashboard.title': '儀錶板',
  'dashboard.subtitle': '知識庫與圖譜概覽',
  'dashboard.docOverview': '文件概覽',
  'dashboard.graphOverview': '知識圖譜概覽',
  'dashboard.processingTasks': '處理任務',
  'dashboard.failedTasks': '失敗任務',
  'dashboard.noProcessing': '暫無處理中的任務',
  'dashboard.noFailed': '暫無失敗任務',
  'dashboard.totalDocs': '共 {count} 個文件，已完成 {completed} 個',
  'dashboard.graphStats': '共 {nodes} 個節點，{edges} 條關係',

  // Knowledge
  'knowledge.title': '知識庫管理',
  'knowledge.subtitle': '上傳和管理知識庫文件，支援 PDF、Office、TXT、圖片格式',
  'knowledge.upload': '上傳文件',
  'knowledge.dragDrop': '拖曳檔案至此或點擊上傳',
  'knowledge.supportedFormats': '支援 PDF、Word、PPT、Excel、圖片等格式',
  'knowledge.status': '狀態',
  'knowledge.format': '格式',
  'knowledge.allStatus': '全部狀態',
  'knowledge.allFormat': '全部格式',
  'knowledge.completed': '已完成',
  'knowledge.parsing': '解析中',
  'knowledge.extracting': '提取中',
  'knowledge.uploading': '上傳中',
  'knowledge.failed': '失敗',

  // Graph
  'graph.title': '知識圖譜',
  'graph.subtitle': '視覺化展示實體關係網絡，共 {nodes} 個節點、{edges} 條關係',
  'graph.search': '搜尋節點或本質描述...',
  'graph.retrieval': '檢索測試',
  'graph.retrievalTitle': '智慧問答',
  'graph.inputQuestion': '輸入問題，例如：如何提升團隊效率？',
  'graph.startRetrieval': '開始檢索',
  'graph.answer': '回答',
  'graph.matchedEntities': '匹配實體',
  'graph.evidence': '相關證據',

  // Settings
  'settings.title': '系統設定',
  'settings.subtitle': '管理您的帳戶和系統偏好設定',
  'settings.appearance': '外觀設定',
  'settings.theme': '主題模式',
  'settings.themeDesc': '選擇淺色或深色主題',
  'settings.light': '淺色',
  'settings.dark': '深色',
  'settings.system': '跟隨系統',
  'settings.notifications': '通知設定',
  'settings.browserNotifications': '瀏覽器通知',
  'settings.browserNotificationsDesc': '接收文件處理完成、失敗等瀏覽器推播通知',
  'settings.language': '顯示語言',
  'settings.languageDesc': '選擇介面顯示語言',
  'settings.security': '安全設定',
  'settings.twoFactor': '雙因素驗證',
  'settings.twoFactorDesc': '使用手機驗證碼進行二次驗證',
  'settings.autoLogout': '自動登出',
  'settings.autoLogoutDesc': '長時間未操作自動登出',
  'settings.saveSettings': '儲存設定',
  'settings.saving': '儲存中...',
  'settings.saved': '設定已儲存',
  'settings.saveFailed': '儲存失敗',

  // Auth
  'auth.login': '登入',
  'auth.register': '註冊',
  'auth.logout': '登出',
  'auth.username': '使用者名稱',
  'auth.password': '密碼',
  'auth.email': '電子郵件',
  'auth.forgotPassword': '忘記密碼？',
  'auth.noAccount': '還沒有帳號？',
  'auth.hasAccount': '已有帳號？',
  'auth.loginSuccess': '登入成功',
  'auth.loginFailed': '登入失敗',
  'auth.registerSuccess': '註冊成功',
  'auth.registerFailed': '註冊失敗',

  // Sidebar
  'sidebar.brand': '管理後台',
  'sidebar.lightMode': '淺色模式',
  'sidebar.darkMode': '深色模式',

  // Notification
  'notification.docCompleted': '文件處理完成',
  'notification.docCompletedDesc': '已成功解析並加入知識圖譜',
  'notification.docFailed': '文件處理失敗',
  'notification.docFailedDesc': '解析失敗',
  'notification.title': '通知',
  'notification.markAllRead': '全部已讀',
  'notification.empty': '暫無通知',

  // Dashboard extended
  'dashboard.docOverviewDesc': '共 {count} 個文件，已完成 {completed} 個',
  'dashboard.docOverview': '文件概覽',
  'dashboard.graphOverview': '知識圖譜概覽',
  'dashboard.noDocuments': '暫無文件',
  'dashboard.graphOverviewDesc': '共 {nodes} 個節點，{edges} 條關係',
  'dashboard.noGraphData': '暫無圖譜資料',
  'dashboard.processingTasksDesc': '目前正在进行的文件處理任務',
  'dashboard.noProcessingTasks': '暫無處理中的任務',
  'dashboard.failedTasksDesc': '需要關注的失敗任務',
  'dashboard.noFailedTasks': '暫無失敗任務',
  'dashboard.uploadedAt': '上傳於',

  // Stats
  'stat.total': '總文件數',
  'stat.completed': '已完成',
  'stat.processing': '處理中',
  'stat.failed': '失敗',

  // Card
  'card.docList': '文件列表',

  // Label extended
  'label.filename': '檔案名稱',
  'label.size': '大小',
  'label.uploadTime': '上傳時間',
  'label.errorMessage': '錯誤訊息',
  'label.processing': '正在處理中，請稍候...',

  // Table extended
  'table.noDocuments': '暫無文件',

  // Node types
  'nodeType.document': '文件',
  'nodeType.agent': '主體',
  'nodeType.object': '對象',
  'nodeType.concept': '概念',
  'nodeType.event': '事件',
  'nodeType.activity': '活動',
  'nodeType.rule': '規則',
  'nodeType.metric': '指標',
  'nodeType.time': '時間',
  'nodeType.location': '地點',
  'nodeType.statement': '陳述',
  'nodeType.issue': '問題',
  'nodeType.image': '圖片',

  // Edge types
  'edgeType.mentions': '提及',
  'edgeType.defines': '定義',
  'edgeType.describes': '描述',
  'edgeType.part_of': '屬於',
  'edgeType.contains': '包含',
  'edgeType.belongs_to': '歸屬於',
  'edgeType.responsible_for': '負責',
  'edgeType.performs': '執行',
  'edgeType.uses': '使用',
  'edgeType.creates': '建立',
  'edgeType.requires': '需要',
  'edgeType.prohibits': '禁止',
  'edgeType.permits': '允許',
  'edgeType.depends_on': '依賴於',
  'edgeType.causes': '導致',
  'edgeType.affects': '影響',
  'edgeType.mitigates': '緩解',
  'edgeType.measures': '度量',
  'edgeType.attribute': '屬性',
  'edgeType.evidence_for': '證據支持',
  'edgeType.contradicts': '矛盾',
  'edgeType.derived_from': '源自',

  // Knowledge extended
  'knowledge.imageFile': '圖片檔案',
  'knowledge.imageFileDesc': '圖片暫無解析內容，請下載查看',
  'knowledge.noContent': '暫無內容',
  'knowledge.processingLog': '處理日誌',
  'knowledge.uploadFile': '上傳知識檔案',
  'knowledge.dropFiles': '釋放檔案以上傳',
  'knowledge.dragHere': '拖曳檔案至此',
  'knowledge.orClickToSelect': '或點擊選擇檔案，支援 PDF、Office、TXT、圖片格式',
  'knowledge.uploadFileTab': '上傳檔案',
  'knowledge.pasteTextTab': '貼上文字',
  'knowledge.textTitle': '標題',
  'knowledge.textTitlePlaceholder': '輸入標題，如：使用者問答記錄',
  'knowledge.textContent': '文字內容',
  'knowledge.textContentPlaceholder': '貼上或輸入文字內容...',
  'knowledge.convertToWiki': '自動轉換為百科格式',
  'knowledge.convertToWikiDesc': '使用AI將文字結構化為維基百科風格的文件',
  'knowledge.submitText': '提交文字',
  'knowledge.textSubmitted': '文字已提交',
  'knowledge.enterTitle': '請輸入標題',
  'knowledge.enterContent': '請輸入文字內容',

  // Filter
  'filter.text': '文字片段',

  // Graph extended
  'graph.feynmanSummary': '費曼總結',
  'graph.previewImage': '預覽圖片',
  'graph.confidence': '置信度',
  'graph.relations': '關聯關係',
  'graph.sourceDocuments': '來源文件',
  'graph.relationTypes': '關係類型',
  'graph.retrievalTest': '檢索測試',
  'graph.problemArchetype': '問題原型',
  'graph.matchedEntities': '匹配實體',
  'graph.relatedEvidence': '相關證據',
  'graph.inputQuestionPlaceholder': '輸入問題，例如：如何提升團隊效率？',
  'graph.emptyGraph': '暫無圖譜資料，請先匯入文件',
  'graph.emptyRetrieval': '輸入問題開始檢索',
  'graph.emptyRetrievalDesc': '基於知識圖譜的智慧問答',
  'graph.evidenceFullText': '全文證據',
  'graph.evidenceParagraph': '段落證據',
  'graph.evidenceSummary': '總結證據',
  'graph.mergeScan': '合併掃描',
  'graph.mergeScanning': '正在掃描重複實體...',
  'graph.mergeCandidates': '疑似重複實體',
  'graph.mergeNoCandidates': '未發現疑似重複實體',
  'graph.mergeReason': '判定原因',
  'graph.mergeConfidence': '相似度',
  'graph.mergePreview': '合併預覽',
  'graph.mergeMergedLabel': '合併後標籤',
  'graph.mergeMergedSummary': '合併後總結',
  'graph.mergeRelationsToMigrate': '待遷移關係',
  'graph.mergeConflicts': '衝突關係',
  'graph.mergeConfirm': '確認合併',
  'graph.mergeReject': '跳過',
  'graph.mergeSuccess': '合併成功，已遷移 {relations} 條關係',
  'graph.mergeFailed': '合併失敗',
  'graph.mergeSelfLoop': '組內關係（將被刪除）',
  'graph.mergeNoScan': '點擊掃描按鈕查找重複實體',

  // Users
  'users.title': '使用者管理',
  'users.subtitle': '管理系統中的所有使用者帳戶',
  'users.createUser': '新建使用者',
  'users.userList': '使用者列表',
  'users.userCount': '共 {count} 個使用者',
  'users.userInfo': '使用者資訊',
  'users.phone': '手機號',
  'users.lastLogin': '最後登入',
  'users.userUpdated': '使用者更新成功',
  'users.userCreated': '使用者建立成功',
  'users.userDeleted': '使用者刪除成功',

  // Roles
  'roles.title': '角色管理',
  'roles.subtitle': '管理系統中的使用者角色及權限分配',
  'roles.createRole': '新建角色',
  'roles.totalRoles': '總角色數',
  'roles.totalRoleUsers': '角色使用者總數',
  'roles.totalPermissions': '權限總數',
  'roles.roleList': '角色列表',
  'roles.roleCount': '共 {count} 個角色',
  'roles.roleName': '角色名稱',
  'roles.roleCode': '角色標識',
  'roles.userCount': '使用者數',
  'roles.permissionCount': '權限數',
  'roles.allPermissions': '全部權限',
  'roles.enabled': '啟用',
  'roles.disabled': '停用',
  'roles.configurePermissions': '配置權限',
  'roles.roleUpdated': '角色更新成功',
  'roles.roleCreated': '角色建立成功',
  'roles.roleDeleted': '角色刪除成功',
  'roles.permissionsSaved': '權限配置已儲存',
  'roles.person': '人',

  // Permissions
  'permissions.title': '權限管理',
  'permissions.subtitle': '檢視和管理系統中的所有權限配置',
  'permissions.totalPermissions': '權限總數',
  'permissions.menuPermissions': '選單權限',
  'permissions.buttonPermissions': '按鈕權限',
  'permissions.apiPermissions': 'API權限',
  'permissions.permissionList': '權限列表',
  'permissions.permissionListDesc': '按模組分類檢視所有權限',
  'permissions.permissionName': '權限名稱',
  'permissions.permissionCode': '權限標識',
  'permissions.module': '所屬模組',
  'permissions.type': '類型',
  'permissions.menu': '選單',
  'permissions.button': '按鈕',
  'permissions.permissionStructure': '權限結構',
  'permissions.permissionStructureDesc': '各模組權限分佈概覽',
  'permissions.item': '項',
  'permissions.more': '更多...',

  // Login
  'login.welcome': '歡迎回來',
  'login.subtitle': '登入您的管理後台帳號',
  'login.rememberMe': '記住我',
  'login.loggingIn': '登入中...',
  'login.noAccount': '還沒有帳號？',
  'login.registerNow': '立即註冊',

  // Register
  'register.createAccount': '建立帳號',
  'register.subtitle': '註冊一個新的管理後台帳號',
  'register.agreeTo': '我已閱讀並同意',
  'register.termsOfService': '使用者協議',
  'register.privacyPolicy': '隱私政策',
  'register.registering': '註冊中...',
  'register.hasAccount': '已有帳號？',
  'register.loginNow': '立即登入',

  // Profile
  'profile.title': '個人資料',
  'profile.subtitle': '管理您的個人資訊',
  'profile.administrator': '管理員',
  'profile.editProfile': '編輯資料',
  'profile.editProfileDesc': '更新您的個人資訊',
  'profile.accountInfo': '帳戶資訊',
  'profile.userId': '使用者ID',
  'profile.createdAt': '註冊時間',
  'profile.accountStatus': '帳號狀態',
  'profile.normal': '正常',
  'profile.profileUpdated': '個人資料更新成功',

  // Change Password
  'changePassword.title': '修改密碼',
  'changePassword.subtitle': '更新您的帳戶密碼以保護帳戶安全',
  'changePassword.passwordSettings': '密碼設定',
  'changePassword.passwordSettingsDesc': '請輸入原密碼並設定新密碼',
  'changePassword.oldPassword': '原密碼',
  'changePassword.newPassword': '新密碼',
  'changePassword.confirmNewPassword': '確認新密碼',
  'changePassword.passwordChanged': '密碼修改成功',
  'changePassword.useNewPassword': '請使用新密碼重新登入',
  'changePassword.securityTips': '安全提示',
  'changePassword.rotatePassword': '定期更換密碼可以提高帳戶安全性',
  'changePassword.uniquePassword': '不要使用與其他網站相同的密碼',
  'changePassword.complexPassword': '密碼中包含大小寫字母、數字和特殊字元更安全',
  'changePassword.keepSecret': '請勿將密碼告知他人或儲存在不安全的地方',
  'changePassword.weak': '弱',
  'changePassword.medium': '中等',
  'changePassword.strong': '強',
  'changePassword.ruleMinLength': '至少6個字元',
  'changePassword.ruleLowercase': '包含小寫字母',
  'changePassword.ruleUppercase': '包含大寫字母',
  'changePassword.ruleNumber': '包含數字',

  // Validation
  'validation.enterUsername': '請輸入使用者名稱',
  'validation.enterPassword': '請輸入密碼',
  'validation.usernameMin': '使用者名稱至少2個字元',
  'validation.usernameMax': '使用者名稱最多20個字元',
  'validation.usernameChars': '使用者名稱只能包含字母、數字、底線和中文',
  'validation.invalidEmail': '請輸入有效的電子郵件地址',
  'validation.passwordMin': '密碼至少6個字元',
  'validation.passwordMax': '密碼最多20個字元',
  'validation.passwordLowercase': '密碼必須包含小寫字母',
  'validation.passwordUppercase': '密碼必須包含大寫字母',
  'validation.passwordNumber': '密碼必須包含數字',
  'validation.passwordSame': '新密碼不能與原密碼相同',
  'validation.passwordMismatch': '兩次輸入的密碼不一致',
  'validation.agreeToTerms': '請閱讀並同意使用者協議',
  'validation.enterOldPassword': '請輸入原密碼',

  // Status
  'status.active': '活躍',
  'status.inactive': '未啟用',
  'status.locked': '已鎖定',
  'status.normal': '正常',
  'status.uploading': '上傳中',
  'status.parsing': '解析中',
  'status.extracting': '抽取中',
  'status.completed': '已完成',
  'status.failed': '失敗',

  // Action
  'action.upload': '上傳檔案',
  'action.retry': '重試',
  'action.download': '下載',
  'action.downloadFile': '下載檔案',
  'action.edit': '編輯',
  'action.delete': '刪除',
  'action.cancel': '取消',
  'action.createUser': '新建使用者',
  'action.createRole': '新建角色',
  'action.configurePermissions': '配置權限',
  'action.retrievalTest': '檢索測試',
  'action.saveChanges': '儲存修改',
  'action.reset': '重置',
  'action.prev': '上一個',
  'action.next': '下一個',

  // Table
  'table.userInfo': '使用者資訊',
  'table.phone': '手機號',
  'table.roles': '角色',
  'table.status': '狀態',
  'table.lastLogin': '最後登入',
  'table.actions': '操作',
  'table.roleName': '角色名稱',
  'table.roleCode': '角色標識',
  'table.description': '描述',
  'table.userCount': '使用者數',
  'table.permissionCount': '權限數',
  'table.permissionName': '權限名稱',
  'table.permissionCode': '權限標識',
  'table.module': '所屬模組',
  'table.type': '類型',
  'table.noData': '暫無資料',

  // Filter
  'filter.allStatus': '全部狀態',
  'filter.allFormat': '全部格式',
  'filter.allTypes': '全部類型',
  'filter.all': '全部',

  // Label
  'label.status': '狀態',
  'label.format': '格式',
  'label.username': '使用者名稱',
  'label.email': '電子郵件',
  'label.phone': '手機號',
  'label.password': '密碼',
  'label.confirmPassword': '確認密碼',
  'label.rememberMe': '記住我',
  'label.administrator': '管理員',
  'label.accountStatus': '帳號狀態',

  // Placeholder
  'placeholder.enterUsername': '請輸入使用者名稱',
  'placeholder.enterPassword': '請輸入密碼',
  'placeholder.enterEmail': '請輸入電子郵件',
  'placeholder.enterPhone': '請輸入手機號',
  'placeholder.confirmPassword': '請再次輸入密碼',
  'placeholder.enterOldPassword': '請輸入原密碼',
  'placeholder.enterNewPassword': '請輸入新密碼',
  'placeholder.confirmNewPassword': '請再次輸入新密碼',
  'placeholder.enterPasswordHint': '請輸入密碼（至少6位）',
  'placeholder.searchDocuments': '搜尋文件...',
  'placeholder.searchUsers': '搜尋使用者名稱或電子郵件...',
  'placeholder.searchRoles': '搜尋角色名稱或標識...',
  'placeholder.searchPermissions': '搜尋權限名稱或標識...',

  // Dialog
  'dialog.confirmDelete': '確認刪除',
  'dialog.confirmDeleteUser': '您確定要刪除這個使用者嗎？此操作不可撤銷。',
  'dialog.confirmDeleteRole': '您確定要刪除這個角色嗎？此操作不可撤銷。',
  'dialog.confirmDeleteDoc': '確定要刪除文件 "{name}" 嗎？此操作無法撤銷。',

  // Error
  'error.fetchUsersFailed': '取得使用者列表失敗',
  'error.fetchRolesFailed': '取得角色列表失敗',
  'error.fetchPermissionsFailed': '取得權限列表失敗',
  'error.operationFailed': '操作失敗',
  'error.deleteFailed': '刪除失敗',
  'error.updateFailed': '更新失敗',
  'error.saveFailed': '儲存失敗',
  'error.loginFailed': '登入失敗',
  'error.registerFailed': '註冊失敗',
  'error.networkError': '網路錯誤，請稍後重試',
  'error.passwordChangeFailed': '密碼修改失敗',
  'error.loadGraphFailed': '載入圖譜資料失敗',
  'error.searchGraphFailed': '搜尋圖譜失敗',
  'error.retrievalFailed': '知識檢索失敗，請稍後重試',
  'error.loadDocumentListFailed': '載入文件列表失敗',
  'error.uploadFailed': '上傳失敗',
  'error.loadFileFailed': '載入檔案失敗',
  'error.loadFailed': '載入失敗',

  // Success
  'success.loginSuccess': '登入成功',
  'success.redirecting': '正在跳轉到管理後台...',
  'success.registerSuccess': '註冊成功',
  'success.refreshed': '已重新整理',

  // Unit
  'unit.person': '人',
  'unit.item': '項',

  // Upload
  'upload.dropFiles': '釋放檔案以上傳',
  'upload.dragHere': '拖曳檔案至此',
  'upload.orClickToSelect': '或點擊選擇檔案，支援 PDF、Office、TXT、圖片格式',

  // Button
  'button.saving': '儲存中...',
  'button.loggingIn': '登入中...',
  'button.registering': '註冊中...',
  'button.login': '登入',
  'button.register': '註冊',

  // Section
  'section.editProfile': '編輯資料',
  'section.editProfileDesc': '更新您的個人資訊',
  'section.accountInfo': '帳戶資訊',
  'section.passwordSettings': '密碼設定',
  'section.passwordSettingsDesc': '請輸入原密碼並設定新密碼',
  'section.securityTips': '安全提示',

  // Tip
  'tip.rotatePassword': '定期更換密碼可以提高帳戶安全性',
  'tip.uniquePassword': '不要使用與其他網站相同的密碼',
  'tip.complexPassword': '密碼中包含大小寫字母、數字和特殊字元更安全',
  'tip.keepSecret': '請勿將密碼告知他人或儲存在不安全的地方',

  // Link
  'link.forgotPassword': '忘記密碼？',
  'link.registerNow': '立即註冊',
  'link.loginNow': '立即登入',
  'link.termsOfService': '使用者協議',
  'link.privacyPolicy': '隱私政策',

  // Search
  'search.placeholder': '搜尋...',
  'search.graphPlaceholder': '搜尋節點或本質描述...',

  // Action (additional)
  'action.save': '儲存',

  // Placeholder (additional)
  'placeholder.selectStatus': '選擇狀態',

  // Validation (additional)
  'validation.roleRequired': '請至少選擇一個角色',
  'validation.descMax': '描述最多200個字元',

  // Users (additional)
  'users.editUser': '編輯使用者',
  'users.editUserDesc': '修改使用者資訊',
  'users.createUserDesc': '建立一個新的使用者帳戶',
  'users.noAvailableRoles': '暫無可用角色，請先建立角色',

  // Label (additional)
  'label.phoneOptional': '手機號（可選）',
  'label.roles': '角色',
  'label.descriptionOptional': '描述（可選）',

  // Roles (additional)
  'roles.editRole': '編輯角色',
  'roles.editRoleDesc': '修改角色資訊',
  'roles.createRoleDesc': '建立一個新的使用者角色',
  'roles.enterRoleName': '請輸入角色名稱',
  'roles.roleCodePlaceholder': '例如：content_editor',
  'roles.enterRoleDesc': '請輸入角色描述',
  'roles.nameMin': '角色名稱至少2個字元',
  'roles.nameMax': '角色名稱最多20個字元',
  'roles.codeMin': '角色標識至少2個字元',
  'roles.codeMax': '角色標識最多30個字元',
  'roles.codePattern': '角色標識只能包含小寫字母和底線',

  // Permissions (additional)
  'permissions.configurePermissions': '配置權限',
  'permissions.configForRole': '為角色 {name} 配置權限',
  'permissions.selectedCount': '已選擇 {count} 項權限',
}

const enUS: Record<string, string> = {
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.search': 'Search',
  'common.loading': 'Loading...',
  'common.noData': 'No data',
  'common.success': 'Success',
  'common.failed': 'Failed',

  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.knowledge': 'Knowledge Base',
  'nav.graph': 'Knowledge Graph',
  'nav.users': 'User Management',
  'nav.roles': 'Role Management',
  'nav.permissions': 'Permission Management',
  'nav.settings': 'Settings',
  'nav.profile': 'Profile',
  'nav.changePassword': 'Change Password',

  // Dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'Knowledge Base & Graph Overview',
  'dashboard.docOverview': 'Document Overview',
  'dashboard.graphOverview': 'Knowledge Graph Overview',
  'dashboard.processingTasks': 'Processing Tasks',
  'dashboard.failedTasks': 'Failed Tasks',
  'dashboard.noProcessing': 'No processing tasks',
  'dashboard.noFailed': 'No failed tasks',
  'dashboard.totalDocs': '{count} documents total, {completed} completed',
  'dashboard.graphStats': '{nodes} nodes, {edges} relationships',

  // Knowledge
  'knowledge.title': 'Knowledge Base',
  'knowledge.subtitle': 'Upload and manage knowledge documents. Supports PDF, Office, TXT, images',
  'knowledge.upload': 'Upload Document',
  'knowledge.dragDrop': 'Drag and drop files here or click to upload',
  'knowledge.supportedFormats': 'Supports PDF, Word, PPT, Excel, images, etc.',
  'knowledge.status': 'Status',
  'knowledge.format': 'Format',
  'knowledge.allStatus': 'All Status',
  'knowledge.allFormat': 'All Formats',
  'knowledge.completed': 'Completed',
  'knowledge.parsing': 'Parsing',
  'knowledge.extracting': 'Extracting',
  'knowledge.uploading': 'Uploading',
  'knowledge.failed': 'Failed',

  // Graph
  'graph.title': 'Knowledge Graph',
  'graph.subtitle': 'Visualize entity relationships. {nodes} nodes, {edges} relationships',
  'graph.search': 'Search nodes or descriptions...',
  'graph.retrieval': 'Retrieval Test',
  'graph.retrievalTitle': 'Intelligent Q&A',
  'graph.inputQuestion': 'Enter a question, e.g.: How to improve team efficiency?',
  'graph.startRetrieval': 'Start Retrieval',
  'graph.answer': 'Answer',
  'graph.matchedEntities': 'Matched Entities',
  'graph.evidence': 'Related Evidence',

  // Settings
  'settings.title': 'Settings',
  'settings.subtitle': 'Manage your account and system preferences',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeDesc': 'Choose light or dark theme',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.system': 'System',
  'settings.notifications': 'Notifications',
  'settings.browserNotifications': 'Browser Notifications',
  'settings.browserNotificationsDesc': 'Receive browser push notifications for document processing',
  'settings.language': 'Language',
  'settings.languageDesc': 'Select interface display language',
  'settings.security': 'Security',
  'settings.twoFactor': 'Two-Factor Authentication',
  'settings.twoFactorDesc': 'Use phone verification code for secondary verification',
  'settings.autoLogout': 'Auto Logout',
  'settings.autoLogoutDesc': 'Automatically logout after long inactivity',
  'settings.saveSettings': 'Save Settings',
  'settings.saving': 'Saving...',
  'settings.saved': 'Settings saved',
  'settings.saveFailed': 'Save failed',

  // Auth
  'auth.login': 'Login',
  'auth.register': 'Register',
  'auth.logout': 'Logout',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.email': 'Email',
  'auth.forgotPassword': 'Forgot password?',
  'auth.noAccount': "Don't have an account?",
  'auth.hasAccount': 'Already have an account?',
  'auth.loginSuccess': 'Login successful',
  'auth.loginFailed': 'Login failed',
  'auth.registerSuccess': 'Registration successful',
  'auth.registerFailed': 'Registration failed',

  // Sidebar
  'sidebar.brand': 'Admin Panel',
  'sidebar.lightMode': 'Light Mode',
  'sidebar.darkMode': 'Dark Mode',

  // Notification
  'notification.docCompleted': 'Document Processed',
  'notification.docCompletedDesc': 'Successfully parsed and added to knowledge graph',
  'notification.docFailed': 'Document Failed',
  'notification.docFailedDesc': 'Parsing failed',
  'notification.title': 'Notifications',
  'notification.markAllRead': 'Mark all read',
  'notification.empty': 'No notifications',

  // Dashboard extended
  'dashboard.docOverviewDesc': '{count} documents total, {completed} completed',
  'dashboard.docOverview': 'Document Overview',
  'dashboard.graphOverview': 'Knowledge Graph Overview',
  'dashboard.noDocuments': 'No documents',
  'dashboard.graphOverviewDesc': '{nodes} nodes, {edges} relationships',
  'dashboard.noGraphData': 'No graph data',
  'dashboard.processingTasksDesc': 'Current document processing tasks',
  'dashboard.noProcessingTasks': 'No processing tasks',
  'dashboard.failedTasksDesc': 'Failed tasks that need attention',
  'dashboard.noFailedTasks': 'No failed tasks',
  'dashboard.uploadedAt': 'Uploaded at',

  // Stats
  'stat.total': 'Total Documents',
  'stat.completed': 'Completed',
  'stat.processing': 'Processing',
  'stat.failed': 'Failed',

  // Card
  'card.docList': 'Document List',

  // Label extended
  'label.filename': 'Filename',
  'label.size': 'Size',
  'label.uploadTime': 'Upload Time',
  'label.errorMessage': 'Error Message',
  'label.processing': 'Processing, please wait...',

  // Table extended
  'table.noDocuments': 'No documents',

  // Node types
  'nodeType.document': 'Document',
  'nodeType.agent': 'Agent',
  'nodeType.object': 'Object',
  'nodeType.concept': 'Concept',
  'nodeType.event': 'Event',
  'nodeType.activity': 'Activity',
  'nodeType.rule': 'Rule',
  'nodeType.metric': 'Metric',
  'nodeType.time': 'Time',
  'nodeType.location': 'Location',
  'nodeType.statement': 'Statement',
  'nodeType.issue': 'Issue',
  'nodeType.image': 'Image',

  // Edge types
  'edgeType.mentions': 'Mentions',
  'edgeType.defines': 'Defines',
  'edgeType.describes': 'Describes',
  'edgeType.part_of': 'Part of',
  'edgeType.contains': 'Contains',
  'edgeType.belongs_to': 'Belongs to',
  'edgeType.responsible_for': 'Responsible for',
  'edgeType.performs': 'Performs',
  'edgeType.uses': 'Uses',
  'edgeType.creates': 'Creates',
  'edgeType.requires': 'Requires',
  'edgeType.prohibits': 'Prohibits',
  'edgeType.permits': 'Permits',
  'edgeType.depends_on': 'Depends on',
  'edgeType.causes': 'Causes',
  'edgeType.affects': 'Affects',
  'edgeType.mitigates': 'Mitigates',
  'edgeType.measures': 'Measures',
  'edgeType.attribute': 'Attribute',
  'edgeType.evidence_for': 'Evidence for',
  'edgeType.contradicts': 'Contradicts',
  'edgeType.derived_from': 'Derived from',

  // Knowledge extended
  'knowledge.imageFile': 'Image File',
  'knowledge.imageFileDesc': 'No parsed content for images, please download to view',
  'knowledge.noContent': 'No content',
  'knowledge.processingLog': 'Processing Log',
  'knowledge.uploadFile': 'Upload Knowledge File',
  'knowledge.dropFiles': 'Drop files to upload',
  'knowledge.dragHere': 'Drag files here',
  'knowledge.orClickToSelect': 'or click to select files. Supports PDF, Office, TXT, images',
  'knowledge.uploadFileTab': 'Upload File',
  'knowledge.pasteTextTab': 'Paste Text',
  'knowledge.textTitle': 'Title',
  'knowledge.textTitlePlaceholder': 'Enter title, e.g.: User Q&A History',
  'knowledge.textContent': 'Text Content',
  'knowledge.textContentPlaceholder': 'Paste or type text content...',
  'knowledge.convertToWiki': 'Auto-convert to Wiki format',
  'knowledge.convertToWikiDesc': 'Use AI to restructure text into Wikipedia-style document',
  'knowledge.submitText': 'Submit Text',
  'knowledge.textSubmitted': 'Text submitted',
  'knowledge.enterTitle': 'Please enter a title',
  'knowledge.enterContent': 'Please enter text content',

  // Filter
  'filter.text': 'Text Snippet',

  // Graph extended
  'graph.feynmanSummary': 'Feynman Summary',
  'graph.previewImage': 'Preview Image',
  'graph.confidence': 'Confidence',
  'graph.relations': 'Relations',
  'graph.sourceDocuments': 'Source Documents',
  'graph.relationTypes': 'Relation Types',
  'graph.retrievalTest': 'Retrieval Test',
  'graph.problemArchetype': 'Problem Archetype',
  'graph.matchedEntities': 'Matched Entities',
  'graph.relatedEvidence': 'Related Evidence',
  'graph.inputQuestionPlaceholder': 'Enter a question, e.g.: How to improve team efficiency?',
  'graph.emptyGraph': 'No graph data yet, please import documents first',
  'graph.emptyRetrieval': 'Enter a question to start retrieval',
  'graph.emptyRetrievalDesc': 'Intelligent Q&A based on knowledge graph',
  'graph.evidenceFullText': 'Full Text',
  'graph.evidenceParagraph': 'Paragraph',
  'graph.evidenceSummary': 'Summary',
  'graph.mergeScan': 'Merge Scan',
  'graph.mergeScanning': 'Scanning for duplicates...',
  'graph.mergeCandidates': 'Duplicate Candidates',
  'graph.mergeNoCandidates': 'No duplicates found',
  'graph.mergeReason': 'Reason',
  'graph.mergeConfidence': 'Similarity',
  'graph.mergePreview': 'Merge Preview',
  'graph.mergeMergedLabel': 'Merged Label',
  'graph.mergeMergedSummary': 'Merged Summary',
  'graph.mergeRelationsToMigrate': 'Relations to Migrate',
  'graph.mergeConflicts': 'Conflicts',
  'graph.mergeConfirm': 'Confirm Merge',
  'graph.mergeReject': 'Skip',
  'graph.mergeSuccess': 'Merge successful, {relations} relations migrated',
  'graph.mergeFailed': 'Merge failed',
  'graph.mergeSelfLoop': 'Intra-group relation (will be deleted)',
  'graph.mergeNoScan': 'Click scan to find duplicate entities',

  // Users
  'users.title': 'User Management',
  'users.subtitle': 'Manage all user accounts in the system',
  'users.createUser': 'Create User',
  'users.userList': 'User List',
  'users.userCount': '{count} users total',
  'users.userInfo': 'User Info',
  'users.phone': 'Phone',
  'users.lastLogin': 'Last Login',
  'users.userUpdated': 'User updated successfully',
  'users.userCreated': 'User created successfully',
  'users.userDeleted': 'User deleted successfully',

  // Roles
  'roles.title': 'Role Management',
  'roles.subtitle': 'Manage user roles and permission assignments',
  'roles.createRole': 'Create Role',
  'roles.totalRoles': 'Total Roles',
  'roles.totalRoleUsers': 'Total Role Users',
  'roles.totalPermissions': 'Total Permissions',
  'roles.roleList': 'Role List',
  'roles.roleCount': '{count} roles total',
  'roles.roleName': 'Role Name',
  'roles.roleCode': 'Role Code',
  'roles.userCount': 'Users',
  'roles.permissionCount': 'Permissions',
  'roles.allPermissions': 'All Permissions',
  'roles.enabled': 'Enabled',
  'roles.disabled': 'Disabled',
  'roles.configurePermissions': 'Configure Permissions',
  'roles.roleUpdated': 'Role updated successfully',
  'roles.roleCreated': 'Role created successfully',
  'roles.roleDeleted': 'Role deleted successfully',
  'roles.permissionsSaved': 'Permissions saved',
  'roles.person': 'users',

  // Permissions
  'permissions.title': 'Permission Management',
  'permissions.subtitle': 'View and manage all permission configurations',
  'permissions.totalPermissions': 'Total Permissions',
  'permissions.menuPermissions': 'Menu Permissions',
  'permissions.buttonPermissions': 'Button Permissions',
  'permissions.apiPermissions': 'API Permissions',
  'permissions.permissionList': 'Permission List',
  'permissions.permissionListDesc': 'View all permissions grouped by module',
  'permissions.permissionName': 'Permission Name',
  'permissions.permissionCode': 'Permission Code',
  'permissions.module': 'Module',
  'permissions.type': 'Type',
  'permissions.menu': 'Menu',
  'permissions.button': 'Button',
  'permissions.permissionStructure': 'Permission Structure',
  'permissions.permissionStructureDesc': 'Permission distribution by module',
  'permissions.item': 'items',
  'permissions.more': 'more...',

  // Login
  'login.welcome': 'Welcome Back',
  'login.subtitle': 'Sign in to your admin account',
  'login.rememberMe': 'Remember me',
  'login.loggingIn': 'Signing in...',
  'login.noAccount': "Don't have an account?",
  'login.registerNow': 'Register now',

  // Register
  'register.createAccount': 'Create Account',
  'register.subtitle': 'Register a new admin account',
  'register.agreeTo': 'I have read and agree to',
  'register.termsOfService': 'Terms of Service',
  'register.privacyPolicy': 'Privacy Policy',
  'register.registering': 'Registering...',
  'register.hasAccount': 'Already have an account?',
  'register.loginNow': 'Sign in now',

  // Profile
  'profile.title': 'Profile',
  'profile.subtitle': 'Manage your personal information',
  'profile.administrator': 'Administrator',
  'profile.editProfile': 'Edit Profile',
  'profile.editProfileDesc': 'Update your personal information',
  'profile.accountInfo': 'Account Info',
  'profile.userId': 'User ID',
  'profile.createdAt': 'Created At',
  'profile.accountStatus': 'Account Status',
  'profile.normal': 'Active',
  'profile.profileUpdated': 'Profile updated successfully',

  // Change Password
  'changePassword.title': 'Change Password',
  'changePassword.subtitle': 'Update your account password for security',
  'changePassword.passwordSettings': 'Password Settings',
  'changePassword.passwordSettingsDesc': 'Enter your current password and set a new one',
  'changePassword.oldPassword': 'Current Password',
  'changePassword.newPassword': 'New Password',
  'changePassword.confirmNewPassword': 'Confirm New Password',
  'changePassword.passwordChanged': 'Password changed successfully',
  'changePassword.useNewPassword': 'Please sign in with your new password',
  'changePassword.securityTips': 'Security Tips',
  'changePassword.rotatePassword': 'Regularly changing your password improves account security',
  'changePassword.uniquePassword': "Don't use the same password as other websites",
  'changePassword.complexPassword': 'Passwords with uppercase, lowercase, numbers, and special characters are more secure',
  'changePassword.keepSecret': 'Never share your password or store it insecurely',
  'changePassword.weak': 'Weak',
  'changePassword.medium': 'Medium',
  'changePassword.strong': 'Strong',
  'changePassword.ruleMinLength': 'At least 6 characters',
  'changePassword.ruleLowercase': 'Contains lowercase letters',
  'changePassword.ruleUppercase': 'Contains uppercase letters',
  'changePassword.ruleNumber': 'Contains numbers',

  // Validation
  'validation.enterUsername': 'Please enter username',
  'validation.enterPassword': 'Please enter password',
  'validation.usernameMin': 'Username must be at least 2 characters',
  'validation.usernameMax': 'Username must be at most 20 characters',
  'validation.usernameChars': 'Username can only contain letters, numbers, underscores, and Chinese characters',
  'validation.invalidEmail': 'Please enter a valid email address',
  'validation.passwordMin': 'Password must be at least 6 characters',
  'validation.passwordMax': 'Password must be at most 20 characters',
  'validation.passwordLowercase': 'Password must contain lowercase letters',
  'validation.passwordUppercase': 'Password must contain uppercase letters',
  'validation.passwordNumber': 'Password must contain numbers',
  'validation.passwordSame': 'New password cannot be the same as current password',
  'validation.passwordMismatch': 'Passwords do not match',
  'validation.agreeToTerms': 'Please read and agree to the terms of service',
  'validation.enterOldPassword': 'Please enter current password',

  // Status
  'status.active': 'Active',
  'status.inactive': 'Inactive',
  'status.locked': 'Locked',
  'status.normal': 'Active',
  'status.uploading': 'Uploading',
  'status.parsing': 'Parsing',
  'status.extracting': 'Extracting',
  'status.completed': 'Completed',
  'status.failed': 'Failed',

  // Action
  'action.upload': 'Upload',
  'action.retry': 'Retry',
  'action.download': 'Download',
  'action.downloadFile': 'Download File',
  'action.edit': 'Edit',
  'action.delete': 'Delete',
  'action.cancel': 'Cancel',
  'action.createUser': 'Create User',
  'action.createRole': 'Create Role',
  'action.configurePermissions': 'Configure Permissions',
  'action.retrievalTest': 'Retrieval Test',
  'action.saveChanges': 'Save Changes',
  'action.reset': 'Reset',
  'action.prev': 'Previous',
  'action.next': 'Next',

  // Table
  'table.userInfo': 'User Info',
  'table.phone': 'Phone',
  'table.roles': 'Roles',
  'table.status': 'Status',
  'table.lastLogin': 'Last Login',
  'table.actions': 'Actions',
  'table.roleName': 'Role Name',
  'table.roleCode': 'Role Code',
  'table.description': 'Description',
  'table.userCount': 'Users',
  'table.permissionCount': 'Permissions',
  'table.permissionName': 'Permission Name',
  'table.permissionCode': 'Permission Code',
  'table.module': 'Module',
  'table.type': 'Type',
  'table.noData': 'No data',

  // Filter
  'filter.allStatus': 'All Status',
  'filter.allFormat': 'All Formats',
  'filter.allTypes': 'All Types',
  'filter.all': 'All',

  // Label
  'label.status': 'Status',
  'label.format': 'Format',
  'label.username': 'Username',
  'label.email': 'Email',
  'label.phone': 'Phone',
  'label.password': 'Password',
  'label.confirmPassword': 'Confirm Password',
  'label.rememberMe': 'Remember me',
  'label.administrator': 'Administrator',
  'label.accountStatus': 'Account Status',

  // Placeholder
  'placeholder.enterUsername': 'Enter username',
  'placeholder.enterPassword': 'Enter password',
  'placeholder.enterEmail': 'Enter email',
  'placeholder.enterPhone': 'Enter phone number',
  'placeholder.confirmPassword': 'Enter password again',
  'placeholder.enterOldPassword': 'Enter current password',
  'placeholder.enterNewPassword': 'Enter new password',
  'placeholder.confirmNewPassword': 'Enter new password again',
  'placeholder.enterPasswordHint': 'Enter password (at least 6 characters)',
  'placeholder.searchDocuments': 'Search documents...',
  'placeholder.searchUsers': 'Search username or email...',
  'placeholder.searchRoles': 'Search role name or code...',
  'placeholder.searchPermissions': 'Search permission name or code...',

  // Dialog
  'dialog.confirmDelete': 'Confirm Delete',
  'dialog.confirmDeleteUser': 'Are you sure you want to delete this user? This action cannot be undone.',
  'dialog.confirmDeleteRole': 'Are you sure you want to delete this role? This action cannot be undone.',
  'dialog.confirmDeleteDoc': 'Are you sure you want to delete document "{name}"? This action cannot be undone.',

  // Error
  'error.fetchUsersFailed': 'Failed to fetch users',
  'error.fetchRolesFailed': 'Failed to fetch roles',
  'error.fetchPermissionsFailed': 'Failed to fetch permissions',
  'error.operationFailed': 'Operation failed',
  'error.deleteFailed': 'Delete failed',
  'error.updateFailed': 'Update failed',
  'error.saveFailed': 'Save failed',
  'error.loginFailed': 'Login failed',
  'error.registerFailed': 'Registration failed',
  'error.networkError': 'Network error, please try again later',
  'error.passwordChangeFailed': 'Password change failed',
  'error.loadGraphFailed': 'Failed to load graph data',
  'error.searchGraphFailed': 'Failed to search graph',
  'error.retrievalFailed': 'Retrieval failed, please try again later',
  'error.loadDocumentListFailed': 'Failed to load document list',
  'error.uploadFailed': 'Upload failed',
  'error.loadFileFailed': 'Failed to load file',
  'error.loadFailed': 'Load failed',

  // Success
  'success.loginSuccess': 'Login successful',
  'success.redirecting': 'Redirecting to admin panel...',
  'success.registerSuccess': 'Registration successful',
  'success.refreshed': 'Refreshed',

  // Unit
  'unit.person': 'users',
  'unit.item': 'items',

  // Upload
  'upload.dropFiles': 'Drop files to upload',
  'upload.dragHere': 'Drag files here',
  'upload.orClickToSelect': 'or click to select files. Supports PDF, Office, TXT, images',

  // Button
  'button.saving': 'Saving...',
  'button.loggingIn': 'Signing in...',
  'button.registering': 'Registering...',
  'button.login': 'Login',
  'button.register': 'Register',

  // Section
  'section.editProfile': 'Edit Profile',
  'section.editProfileDesc': 'Update your personal information',
  'section.accountInfo': 'Account Info',
  'section.passwordSettings': 'Password Settings',
  'section.passwordSettingsDesc': 'Enter your current password and set a new one',
  'section.securityTips': 'Security Tips',

  // Tip
  'tip.rotatePassword': 'Regularly changing your password improves account security',
  'tip.uniquePassword': "Don't use the same password as other websites",
  'tip.complexPassword': 'Passwords with uppercase, lowercase, numbers, and special characters are more secure',
  'tip.keepSecret': 'Never share your password or store it insecurely',

  // Link
  'link.forgotPassword': 'Forgot password?',
  'link.registerNow': 'Register now',
  'link.loginNow': 'Sign in now',
  'link.termsOfService': 'Terms of Service',
  'link.privacyPolicy': 'Privacy Policy',

  // Search
  'search.placeholder': 'Search...',
  'search.graphPlaceholder': 'Search nodes or descriptions...',

  // Action (additional)
  'action.save': 'Save',

  // Placeholder (additional)
  'placeholder.selectStatus': 'Select status',

  // Validation (additional)
  'validation.roleRequired': 'Please select at least one role',
  'validation.descMax': 'Description must be at most 200 characters',

  // Users (additional)
  'users.editUser': 'Edit User',
  'users.editUserDesc': 'Edit user information',
  'users.createUserDesc': 'Create a new user account',
  'users.noAvailableRoles': 'No available roles, please create one first',

  // Label (additional)
  'label.phoneOptional': 'Phone (Optional)',
  'label.roles': 'Roles',
  'label.descriptionOptional': 'Description (Optional)',

  // Roles (additional)
  'roles.editRole': 'Edit Role',
  'roles.editRoleDesc': 'Edit role information',
  'roles.createRoleDesc': 'Create a new user role',
  'roles.enterRoleName': 'Enter role name',
  'roles.roleCodePlaceholder': 'e.g.: content_editor',
  'roles.enterRoleDesc': 'Enter role description',
  'roles.nameMin': 'Role name must be at least 2 characters',
  'roles.nameMax': 'Role name must be at most 20 characters',
  'roles.codeMin': 'Role code must be at least 2 characters',
  'roles.codeMax': 'Role code must be at most 30 characters',
  'roles.codePattern': 'Role code can only contain lowercase letters and underscores',

  // Permissions (additional)
  'permissions.configurePermissions': 'Configure Permissions',
  'permissions.configForRole': 'Configure permissions for role {name}',
  'permissions.selectedCount': '{count} permissions selected',
}
