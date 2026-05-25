import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useGetConversation, useGetGroup, useListMessages, useListGroupMessages, useSendMessage, useSendGroupMessage, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MoreVertical, Send, Image as ImageIcon, Mic } from "lucide-react";
import DOMPurify from 'dompurify';
import { useQueryClient } from "@tanstack/react-query";
import { socketManager } from "@/lib/socket";

export default function ChatArea({ chatId }: { chatId: string }) {
  const [, setLocation] = useLocation();
  const isGroup = chatId.startsWith("group_");
  const id = parseInt(chatId.replace("dm_", "").replace("group_", ""), 10);
  
  const { data: me } = useGetMe();
  const { data: dmData } = useGetConversation(id, { query: { enabled: !isGroup && !isNaN(id) } });
  const { data: groupData } = useGetGroup(id, { query: { enabled: isGroup && !isNaN(id) } });
  
  const { data: dmMessages } = useListMessages(id, { query: { enabled: !isGroup && !isNaN(id) } });
  const { data: groupMessages } = useListGroupMessages(id, { query: { enabled: isGroup && !isNaN(id) } });
  
  const messages = isGroup ? groupMessages : dmMessages;
  const name = isGroup ? groupData?.name : dmData?.otherUser?.displayName;
  const avatar = isGroup ? groupData?.avatarUrl : dmData?.otherUser?.avatarUrl;
  const isOnline = !isGroup && dmData?.otherUser?.isOnline;
  
  const [inputText, setInputText] = useState("");
  const sendMessageMutation = useSendMessage();
  const sendGroupMessageMutation = useSendGroupMessage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isNaN(id)) {
      if (isGroup) {
        socketManager.socket?.emit('join_group', { groupId: id });
      } else {
        socketManager.socket?.emit('join_conversation', { conversationId: id });
      }
    }
  }, [id, isGroup]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isNaN(id)) return;
    
    if (isGroup) {
      sendGroupMessageMutation.mutate(
        { groupId: id, data: { content: inputText, type: "text" } },
        {
          onSuccess: () => setInputText("")
        }
      );
    } else {
      sendMessageMutation.mutate(
        { conversationId: id, data: { content: inputText, type: "text" } },
        {
          onSuccess: () => setInputText("")
        }
      );
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="h-16 border-b bg-card/80 backdrop-blur shrink-0 flex items-center justify-between px-4 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setLocation("/chat")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatar || undefined} />
            <AvatarFallback>{name?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{name || "Loading..."}</div>
            {isOnline && <div className="text-xs text-primary font-medium">Active now</div>}
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto flex flex-col justify-end min-h-full pb-4">
          {messages?.map((msg, index) => {
            const isMe = msg.senderId === me?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border rounded-bl-sm'}`}>
                  {isGroup && !isMe && <div className="text-xs font-semibold text-primary mb-1">{msg.sender?.displayName}</div>}
                  <div 
                    className="text-sm break-words" 
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content || "") }} 
                  />
                  <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 bg-card border-t shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="flex-1 bg-muted/50 rounded-2xl border flex items-center pr-1 overflow-hidden transition-colors focus-within:border-primary/50 focus-within:bg-background">
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground rounded-xl">
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Input 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message..." 
              className="border-0 bg-transparent focus-visible:ring-0 px-1"
              autoComplete="off"
            />
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground rounded-xl">
              <Mic className="h-5 w-5" />
            </Button>
          </div>
          <Button 
            type="submit" 
            size="icon" 
            className="shrink-0 rounded-full h-11 w-11"
            disabled={!inputText.trim() || sendMessageMutation.isPending || sendGroupMessageMutation.isPending}
          >
            <Send className="h-5 w-5 ml-0.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
