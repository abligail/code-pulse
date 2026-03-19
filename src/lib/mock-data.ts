// Mock data utilities for the C language learning platform

const addDays = (base: Date, days: number) => {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

// ==================== CHAT API ====================
export const mockChatResponse = (message: string) => {
  // Simulate delay
  const delay = Math.random() * 500 + 500;
  
  return {
    answer: `关于"${message}"的问题，这里是一些思路提示：

1. **理解问题的核心**：首先需要理解题目要求你做什么
2. **关键步骤**：
   - 步骤1：分析输入输出要求
   - 步骤2：设计算法流程
   - 步骤3：考虑边界情况

🔍 **你需要注意的点**：
- 数组下标从0开始
- 避免数组越界
- 注意内存分配和释放

💡 **引导问题**：
- 你是否已经写出了大致的框架？
- 遇到了什么具体的困难？
- 可以告诉我你想到的解题思路吗？`,
    followups: [
      '能否给我更详细的提示？',
      '我想了解相关的语法知识',
      '帮我分析一下代码错误',
      '我想练习类似的题目'
    ],
    entities: [
      { name: '数组', type: '概念' },
      { name: '指针', type: '概念' },
      { name: '内存管理', type: '概念' }
    ],
    questionCard: {
      title: '本轮思考题',
      prompt: `围绕“${message}”，请总结一个关键概念，并列举一个常见错误。`,
      hints: ['先尝试用自己的话解释概念', '回忆你最容易忽略的边界情况', '用一句话总结错误产生的原因']
    }
  };
};

// ==================== KNOWLEDGE CARDS API ====================
export const mockKnowledgeCards = () => {
  return {
    cards: [
      {
        id: 'card-1',
        title: '数组',
        nodeType: '概念',
        sections: [
          {
            name: '定义' as const,
            content: '数组是一组相同类型数据的集合，在内存中连续存储。数组名是数组首元素的地址。'
          },
          {
            name: '语法' as const,
            content: '类型 数组名[大小];\n例如：int arr[10];'
          },
          {
            name: '常见坑' as const,
            content: '1. 数组越界\n2. 未初始化的数组元素值不确定\n3. 数组名作为指针时不能直接修改'
          },
          {
            name: '示例' as const,
            content: 'int arr[5] = {1, 2, 3, 4, 5};\nfor(int i=0; i<5; i++) {\n    printf("%d ", arr[i]);\n}'
          },
          {
            name: '相关概念' as const,
            content: '指针、字符串、多维数组'
          }
        ]
      },
      {
        id: 'card-2',
        title: '指针',
        nodeType: '概念',
        sections: [
          {
            name: '定义' as const,
            content: '指针是存储内存地址的变量。通过指针可以间接访问和操作内存中的数据。'
          },
          {
            name: '语法' as const,
            content: '类型 *指针名;\nint *p;\np = &变量;'
          },
          {
            name: '常见坑' as const,
            content: '1. 空指针解引用\n2. 野指针\n3. 指针运算错误'
          },
          {
            name: '示例' as const,
            content: 'int a = 10;\nint *p = &a;\nprintf("%d", *p); // 输出10'
          },
          {
            name: '相关概念' as const,
            content: '数组、结构体、函数指针'
          }
        ]
      },
      {
        id: 'card-3',
        title: '递归',
        nodeType: '算法',
        sections: [
          {
            name: '定义' as const,
            content: '递归是一种解决问题的方法，函数调用自身来解决问题。'
          },
          {
            name: '语法' as const,
            content: '返回类型 函数名(参数) {\n    if(终止条件) return 基本情况;\n    return 函数名(更小规模的参数);\n}'
          },
          {
            name: '常见坑' as const,
            content: '1. 缺少终止条件导致栈溢出\n2. 递归深度过大\n3. 重复计算'
          },
          {
            name: '示例' as const,
            content: 'int factorial(int n) {\n    if(n <= 1) return 1;\n    return n * factorial(n-1);\n}'
          },
          {
            name: '相关概念' as const,
            content: '栈、尾递归、动态规划'
          }
        ]
      },
      {
        id: 'card-4',
        title: '结构体',
        nodeType: '语法',
        sections: [
          {
            name: '定义' as const,
            content: '结构体是用户自定义的数据类型，可以包含多个不同类型的成员。'
          },
          {
            name: '语法' as const,
            content: 'struct 结构体名 {\n    类型 成员1;\n    类型 成员2;\n};'
          },
          {
            name: '常见坑' as const,
            content: '1. 结构体对齐问题\n2. 深拷贝与浅拷贝\n3. 结构体指针访问'
          },
          {
            name: '示例' as const,
            content: 'struct Student {\n    char name[20];\n    int age;\n    float score;\n};'
          },
          {
            name: '相关概念' as const,
            content: '联合体、枚举、链表'
          }
        ]
      },
      {
        id: 'card-5',
        title: '链表',
        nodeType: '数据结构',
        sections: [
          {
            name: '定义' as const,
            content: '链表是一种动态数据结构，由节点组成，每个节点包含数据和指向下一个节点的指针。'
          },
          {
            name: '语法' as const,
            content: 'struct Node {\n    int data;\n    struct Node* next;\n};'
          },
          {
            name: '常见坑' as const,
            content: '1. 内存泄漏\n2. 空指针检查\n3. 链表断裂'
          },
          {
            name: '示例' as const,
            content: 'struct Node* head = NULL;\nhead = malloc(sizeof(struct Node));\nhead->data = 1;\nhead->next = NULL;'
          },
          {
            name: '相关概念' as const,
            content: '指针、动态内存分配、栈'
          }
        ]
      }
    ]
  };
};

// ==================== CODE RUN API ====================
export const mockRunCode = (code: string, input?: string) => {
  // Simulate a code run response
  if (code.includes('error') || code.includes('Error')) {
    return {
      success: false,
      errorType: '编译错误',
      errorLines: [5, 6],
      errorLinesSummary: '语法错误：缺少分号',
      errorSummary: '代码中存在语法错误，导致编译失败',
      error: `error: expected ';' before 'return'\n    return 0;\n           ^\n1 error generated.`
    };
  }

  if (code.includes('segmentation') || code.includes('Segmentation')) {
    return {
      success: false,
      errorType: '运行时错误',
      errorLines: [12],
      errorLinesSummary: '段错误：空指针解引用',
      errorSummary: '程序运行时访问了非法内存地址',
      error: `Segmentation fault (core dumped)\nProgram received signal SIGSEGV`
    };
  }

  // Success case
  return {
    success: true,
    data: {
      output: input ? `Input: ${input}\nOutput: Hello, World!\n` : 'Hello, World!\n',
      compileTime: '0.12s',
      runTime: '0.03s',
      totalTime: '0.15s',
      hasInput: !!input,
      exitCode: 0
    }
  };
};

// ==================== CODE REVIEW API ====================
export const mockReview = (code: string, mode: 'syntax' | 'style' | 'logic', runResult?: any) => {
  const reviews = {
    syntax: {
      status: 'ok' as const,
      summary: '代码语法正确，无明显语法错误',
      details: [
        '变量声明规范',
        '函数定义完整',
        '分号使用正确'
      ],
      suggestions: [
        '建议在数组声明时指定明确的大小',
        '考虑添加const修饰符保护常量'
      ],
      questions: [
        '你确定所有数组访问都在有效范围内吗？',
        '是否考虑了输入参数的边界条件？'
      ]
    },
    style: {
      status: 'ok' as const,
      summary: '代码风格整体良好，有改进空间',
      details: [
        '变量命名基本清晰',
        '缩进格式统一',
        '缺少注释说明'
      ],
      suggestions: [
        '建议添加函数注释说明功能和参数',
        '复杂逻辑处添加行内注释',
        '命名可以更加语义化'
      ],
      questions: [
        '这个变量的具体含义是什么？',
        '这个复杂逻辑能否拆分成更小的函数？'
      ]
    },
    logic: {
      status: 'ok' as const,
      summary: '逻辑基本正确，存在潜在问题',
      details: [
        '算法思路清晰',
        '循环结构合理',
        '缺少错误处理'
      ],
      suggestions: [
        '添加输入验证，防止非法输入',
        '考虑内存分配失败的边界情况',
        '添加必要的错误处理机制'
      ],
      questions: [
        '如果输入为空，程序会如何处理？',
        '你认为还有哪些边界情况需要考虑？'
      ]
    }
  };

  // Simulate occasional timeout
  if (Math.random() < 0.1) {
    return {
      status: 'timeout' as const,
      summary: '该分支暂不可用',
      details: [],
      suggestions: [],
      questions: []
    };
  }

  return reviews[mode];
};

// ==================== PRACTICE LIST API ====================
export const mockPracticeList = (topic?: string, level?: string) => {
  return {
    items: [
      {
        id: 'practice-1',
        title: '数组逆序输出',
        topic: '数组',
        level: '入门',
        status: 'new' as const,
        source: 'review' as const,
        sourceNote: '来自今日复习队列',
        adaptiveLevel: '入门' as const,
        adaptiveNote: '适合作为热身题'
      },
      {
        id: 'practice-2',
        title: '指针实现字符串长度',
        topic: '指针',
        level: '入门',
        status: 'done' as const,
        source: 'weak' as const,
        sourceNote: '薄弱点巩固',
        adaptiveLevel: '入门' as const,
        adaptiveNote: '建议再做一题同类练习'
      },
      {
        id: 'practice-3',
        title: '递归计算斐波那契数列',
        topic: '递归',
        level: '基础',
        status: 'in_progress' as const,
        source: 'teacher' as const,
        sourceNote: '课堂重点',
        adaptiveLevel: '基础' as const,
        adaptiveNote: '完成后再挑战提高题'
      },
      {
        id: 'practice-4',
        title: '实现链表的基本操作',
        topic: '链表',
        level: '提高',
        status: 'new' as const,
        source: 'system' as const,
        sourceNote: '系统推荐',
        adaptiveLevel: '提高' as const,
        adaptiveNote: '建议先完成 2 题基础'
      },
      {
        id: 'practice-5',
        title: '快速排序算法实现',
        topic: '排序',
        level: '提高',
        status: 'new' as const,
        source: 'teacher' as const,
        sourceNote: '阶段测评',
        adaptiveLevel: '提高' as const,
        adaptiveNote: '挑战题，注意时间复杂度'
      }
    ]
  };
};

// ==================== PRACTICE DETAIL API ====================
export const mockPracticeDetail = (id: string) => {
  return {
    id,
    title: '数组逆序输出',
    promptMarkdown: `# 数组逆序输出

**题目描述**：
编写一个程序，输入一个整数数组，将数组中的元素逆序后输出。

**要求**：
1. 使用指针操作实现
2. 不使用额外的数组空间
3. 处理边界情况（空数组、单元素数组）

**输入示例**：
\`\`\`
1 2 3 4 5
\`\`\`

**输出示例**：
\`\`\`
5 4 3 2 1
\`\`\``,
    ioDesc: '输入：一行整数，用空格分隔\n输出：逆序后的数组，用空格分隔',
    samples: [
      {
        input: '1 2 3 4 5',
        output: '5 4 3 2 1'
      },
      {
        input: '10',
        output: '10'
      }
    ]
  };
};

// ==================== PRACTICE SUBMIT API ====================
export const mockPracticeSubmit = (id: string, code: string) => {
  // Simulate random pass/fail
  const isPass = Math.random() > 0.5;

  if (isPass) {
    return {
      status: 'pass' as const,
      score: 100,
      feedback: '🎉 恭喜！你的代码通过了所有测试用例！\n\n你的实现思路清晰，代码结构良好。',
      hints: []
    };
  } else {
    return {
      status: 'fail' as const,
      score: 60,
      feedback: '❌ 代码未通过所有测试用例\n\n有些测试用例未能通过，请检查：\n1. 边界情况是否考虑完整？\n2. 指针操作是否正确？',
      hints: [
        '提示：考虑使用双指针方法',
        '提示：检查数组索引是否越界',
        '提示：思考如何原地交换元素'
      ]
    };
  }
};

// ==================== USER PROFILE API ====================
export const mockUserProfile = () => {
  const today = new Date();
  const todayLabel = formatDate(today);
  const tomorrowLabel = formatDate(addDays(today, 1));
  const inThreeDaysLabel = formatDate(addDays(today, 3));
  const lastQuestionAt = addDays(today, -2).toISOString();

  return {
    weakPoints: [
      { name: '指针运算', nodeType: '概念', mastery: 2, lastSeen: '2天前' },
      { name: '链表操作', nodeType: '数据结构', mastery: 3, lastSeen: '5天前' },
      { name: '动态内存分配', nodeType: '概念', mastery: 2, lastSeen: '1周前' },
      { name: '递归算法', nodeType: '算法', mastery: 3, lastSeen: '3天前' },
      { name: '文件操作', nodeType: '语法', mastery: 4, lastSeen: '2周前' }
    ],
    errorStats: [
      { type: '段错误', count: 15 },
      { type: '数组越界', count: 12 },
      { type: '内存泄漏', count: 8 },
      { type: '空指针', count: 6 }
    ],
    reviewQueue: [
      { nodeId: 'node-1', name: '指针运算', dueAt: todayLabel, reason: 'weak' as const },
      { nodeId: 'node-2', name: '链表操作', dueAt: todayLabel, reason: 'ebbinghaus' as const },
      { nodeId: 'node-3', name: '动态内存分配', dueAt: tomorrowLabel, reason: 'teacher' as const }
    ],
    reviewPlan: [
      { name: '指针运算', nextAt: todayLabel },
      { name: '链表操作', nextAt: tomorrowLabel },
      { name: '动态内存分配', nextAt: inThreeDaysLabel }
    ],
    lastQuestion: {
      id: 'last-q-1',
      title: '如何判断指针是否越界，并避免段错误？',
      askedAt: lastQuestionAt
    }
  };
};

// ==================== TEACHER REQUIREMENTS API ====================
export const mockTeacherRequirements = (classId?: string) => {
  return {
    classId: classId || 'class2',
    className: classId === 'class1' ? '计算机1班' : classId === 'class3' ? '计算机3班' : '计算机2班',
    updatedAt: '2026-02-01',
    nodes: [
      {
        nodeId: 'req-1',
        nodeName: '指针基础',
        nodeType: '概念',
        targetMastery: 4,
        minChatRounds: 2,
        minPracticeCount: 3,
        priority: 5,
        deadlineAt: '2026-02-20',
        tags: ['高频', '必修'],
        note: '重点解决指针越界与空指针问题。',
        groupName: '第2周'
      },
      {
        nodeId: 'req-2',
        nodeName: '链表操作',
        nodeType: '数据结构',
        targetMastery: 4,
        minChatRounds: 3,
        minPracticeCount: 4,
        priority: 4,
        deadlineAt: '2026-03-01',
        tags: ['综合题'],
        note: '要求能够独立实现增删改查。',
        groupName: '第3周'
      },
      {
        nodeId: 'req-3',
        nodeName: '递归与分治',
        nodeType: '算法',
        targetMastery: 3,
        minChatRounds: 1,
        minPracticeCount: 2,
        priority: 3,
        deadlineAt: '2026-03-10',
        tags: ['方法论'],
        groupName: '第4周'
      },
      {
        nodeId: 'req-4',
        nodeName: '结构体与内存布局',
        nodeType: '语法',
        targetMastery: 3,
        minChatRounds: 1,
        minPracticeCount: 1,
        priority: 2,
        groupName: '第4周'
      },
      {
        nodeId: 'req-5',
        nodeName: '文件读写',
        nodeType: '语法',
        targetMastery: 2,
        minChatRounds: 1,
        minPracticeCount: 1,
        priority: 2,
        deadlineAt: '2026-03-20',
        tags: ['实验'],
        note: '强调错误处理与资源关闭。',
        groupName: '第5周'
      }
    ]
  };
};
