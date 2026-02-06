'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PageState } from '@/components/ui/page-state';
import { ClientIcon } from '@/components/client-icon';
import type { KnowledgeCard } from '@/lib/api/chat';

interface KnowledgeCardsPanelProps {
  cards: KnowledgeCard[];
  showCards: boolean;
  setShowCards: (show: boolean) => void;
  selectedCard: KnowledgeCard | null;
  setSelectedCard: (card: KnowledgeCard | null) => void;
  onCardOpen?: (card: KnowledgeCard) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function KnowledgeCardsPanel({
  cards,
  showCards,
  setShowCards,
  selectedCard,
  setSelectedCard,
  onCardOpen,
  isLoading = false,
  error,
  onRetry,
  emptyTitle = '暂无相关概念卡',
  emptyDescription = '知识卡片暂不可用，或未检测到相关概念。',
}: KnowledgeCardsPanelProps) {
  const handleSelectCard = (card: KnowledgeCard) => {
    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
      return;
    }
    setSelectedCard(card);
    onCardOpen?.(card);
  };

  const renderCardItem = (card: KnowledgeCard, index: number) => (
    <Card
      key={card.id}
      className={`motion-fade-up hover-lift cursor-pointer border-border/75 py-4 ${
        selectedCard?.id === card.id
          ? 'border-primary/40 bg-[linear-gradient(145deg,rgba(37,99,235,0.14),rgba(14,116,144,0.05))] shadow-[0_20px_30px_-24px_rgba(15,23,42,0.7)]'
          : 'bg-card/88 hover:bg-accent/40'
      }`}
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
      onClick={() => handleSelectCard(card)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="line-clamp-1 text-sm">{card.title}</CardTitle>
          <Badge variant="outline" className="text-[11px]">
            {card.nodeType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {card.sections[0]?.content}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="surface-panel-strong space-y-4 p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground/95">知识卡片</h3>
          <p className="text-xs text-muted-foreground">当前共 {cards.length} 张</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowCards(!showCards)}>
          {showCards ? (
            <ClientIcon icon={ChevronDown} className="h-4 w-4" />
          ) : (
            <ClientIcon icon={ChevronRight} className="h-4 w-4" />
          )}
        </Button>
      </div>

      {showCards && (
        <>
          {isLoading ? (
            <PageState
              variant="loading"
              size="sm"
              className="border-0 bg-transparent p-0 md:p-0"
              description="正在加载知识卡片..."
            />
          ) : error ? (
            <PageState
              variant="error"
              size="sm"
              className="border-0 bg-transparent p-0 md:p-0"
              title="知识卡片加载失败"
              description={error}
              action={
                onRetry ? (
                  <Button size="sm" variant="outline" onClick={onRetry}>
                    重试
                  </Button>
                ) : undefined
              }
            />
          ) : cards.length === 0 ? (
            <PageState
              variant="empty"
              size="sm"
              className="border-0 bg-transparent p-0 md:p-0"
              title={emptyTitle}
              description={emptyDescription}
            />
          ) : (
            <div className="space-y-3">
              {cards.slice(0, 5).map((card, index) => renderCardItem(card, index))}

              {cards.length > 5 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      展开更多 ({cards.length - 5})
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    {cards.slice(5).map((card, index) => renderCardItem(card, index + 5))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {selectedCard && !isLoading && !error && cards.length > 0 && (
            <Card className="border-primary/30 bg-card/94 py-5">
              <CardHeader>
                <CardTitle className="text-lg">{selectedCard.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={selectedCard.sections[0]?.name} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    {selectedCard.sections.slice(0, 3).map((section) => (
                      <TabsTrigger key={section.name} value={section.name} className="text-xs">
                        {section.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {selectedCard.sections.map((section) => (
                    <TabsContent key={section.name} value={section.name} className="mt-4">
                      <pre className="whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/45 p-3 font-mono text-xs leading-relaxed">
                        {section.content}
                      </pre>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
