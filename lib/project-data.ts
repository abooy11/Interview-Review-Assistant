export const PROJECTS = [
  {
    id: "baseline",
    title: "一面：把经历讲散了",
    year: "2026",
    services: ["项目经验", "逻辑表达"],
    linkText: "去新建复盘",
    linkUrl: "/new-review",
    overview: {
      title: "这场面试",
      content:
        "面试官连续追问一个项目的取舍。回答里堆了背景，没有先说结论，也没有讲清为什么当时那样选。",
    },
    direction: {
      title: "哪里不稳",
      content:
        "项目经历停在过程描述，缺少指标和取舍。被追问时容易把时间线再讲一遍，而不是补上判断。",
    },
    outcome: {
      title: "下次准备",
      content:
        "每个项目先用一句话给出结果，再补一个关键数字和一次放弃的方案。终稿里把这三句单独留下。",
    },
    heroImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=900&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&h=900&fit=crop",
    ],
    nextProject: "elan",
  },
  {
    id: "elan",
    title: "二面：业务问题答虚了",
    year: "2026",
    services: ["业务理解", "岗位匹配"],
    linkText: "去新建复盘",
    linkUrl: "/new-review",
    overview: {
      title: "这场面试",
      content:
        "二面开始问为什么做这个功能、用户是谁、不做会怎样。回答停在功能清单，没有落到一个具体用户和一次真实取舍。",
    },
    direction: {
      title: "哪里不稳",
      content:
        "业务理解被讲成产品说明书。面试官要的是判断，回答给的是模块介绍。",
    },
    outcome: {
      title: "下次准备",
      content:
        "挑一个功能，写清用户、当时的约束，以及没做的那个方案。复盘时把这道题收进关键问题。",
    },
    heroImage: "https://images.unsplash.com/photo-1567016432779-094069958ea5?w=1200&h=900&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&h=900&fit=crop",
    ],
    nextProject: "nexus",
  },
  {
    id: "nexus",
    title: "数据题：数字没有口径",
    year: "2025",
    services: ["数据分析", "逻辑表达"],
    linkText: "去新建复盘",
    linkUrl: "/new-review",
    overview: {
      title: "这场面试",
      content:
        "问到转化率时给了一个百分比，但没说分子分母，也没说这个数是哪一段时间的。追问之后开始改口。",
    },
    direction: {
      title: "哪里不稳",
      content:
        "数字是记得的，口径是临时补的。面试官听得出结论和数据对不上。",
    },
    outcome: {
      title: "下次准备",
      content:
        "每个关键数字写成「谁、在哪段时间、分子分母是什么」。复盘评分里单独看数据分析这一项。",
    },
    heroImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=900&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&h=900&fit=crop",
    ],
    nextProject: "aurora",
  },
  {
    id: "aurora",
    title: "HR 面：动机说得太满",
    year: "2025",
    services: ["沟通表达", "岗位匹配"],
    linkText: "去新建复盘",
    linkUrl: "/new-review",
    overview: {
      title: "这场面试",
      content:
        "问为什么看这个岗位时，回答覆盖了行业、公司和title，没有一件和自己已经做过的事对上。",
    },
    direction: {
      title: "哪里不稳",
      content:
        "动机听起来像岗位说明书的复述。没有一个例子说明自己为什么接得住这份工作。",
    },
    outcome: {
      title: "下次准备",
      content:
        "用一段自己的项目说明和这个岗位的交集，控制在四句话里。终稿里把这段单独存下来。",
    },
    heroImage: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&h=900&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1200&h=900&fit=crop",
    ],
    nextProject: "forge",
  },
  {
    id: "forge",
    title: "终面：取舍没有收住",
    year: "2025",
    services: ["产品思维", "业务理解"],
    linkText: "去新建复盘",
    linkUrl: "/new-review",
    overview: {
      title: "这场面试",
      content:
        "终面给了一个资源不够的题。方案列了三条，没有说先做哪条，也没有说剩下两条为什么先不做。",
    },
    direction: {
      title: "哪里不稳",
      content:
        "产品思维停在罗列。面试官要的是顺序和代价，回答给的是可能性。",
    },
    outcome: {
      title: "下次准备",
      content:
        "练习时每道题只留一个先做的方案，并写下一句不做其他方案的原因。复盘时放进下一次准备。",
    },
    heroImage: "https://images.unsplash.com/photo-1565372195458-9de0b320ef04?w=1200&h=900&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1581092162384-8987c1d64718?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&h=900&fit=crop",
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1200&h=900&fit=crop",
    ],
    nextProject: "baseline",
  },
]

export const SERVICES_OPTIONS = ["项目经验", "业务理解", "数据分析", "沟通表达", "其他"]
export const BUDGET_OPTIONS = ["一面", "二面", "三面", "HR面", "终面"]

export function getProjectById(id: string) {
  return PROJECTS.find((p) => p.id === id)
}

export function getNextProject(currentId: string) {
  const current = getProjectById(currentId)
  if (!current) return PROJECTS[0]
  return getProjectById(current.nextProject) || PROJECTS[0]
}
