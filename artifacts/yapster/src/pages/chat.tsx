import { useLocation, Route, Switch, useParams } from "wouter";
import { useAuthStore } from "@/hooks/use-auth-store";
import { MessageSquare, Settings, UserCircle, Search, Hash } from "lucide-react";
import { useGetMe, useListConversations, useListGroups } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatArea from "@/components/chat/chat-area";

export default function ChatLayout() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const isChatSelected = !!params.id;
  
  const { data: user } = useGetMe();
  const { data: conversations, isLoading: isLoadingDMs } = useListConversations();
  const { data: groups, isLoading: isLoadingGroups } = useListGroups();

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile if chat is selected */}
      <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col bg-card shrink-0 h-full ${isChatSelected ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <MessageSquare className="h-6 w-6" />
            Yapster
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${user?.id}`)}>
              <UserCircle className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")}>
              <Settings className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="chats" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-2 shrink-0 border-b">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="chats">Chats</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background h-9 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="chats" className="m-0 border-none p-2 space-y-1 h-full">
              {isLoadingDMs ? (
                <div className="p-2 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
                        <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations?.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">
                  No conversations yet.
                </div>
              ) : (
                conversations?.map((conv) => (
                  <div 
                    key={conv.id}
                    onClick={() => setLocation(`/chat/dm_${conv.id}`)}
                    className={`flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors ${params.id === `dm_${conv.id}` ? 'bg-muted' : ''}`}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 border border-border">
                        <AvatarImage src={conv.otherUser?.avatarUrl || undefined} />
                        <AvatarFallback>{conv.otherUser?.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {conv.otherUser?.isOnline && (
                        <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{conv.otherUser?.displayName}</span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                          {conv.lastMessage ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage?.content || "No messages yet"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="groups" className="m-0 border-none p-2 space-y-1 h-full">
              {isLoadingGroups ? (
                <div className="p-2 space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
                        <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : groups?.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">
                  No groups yet.
                </div>
              ) : (
                groups?.map((group) => (
                  <div 
                    key={group.id}
                    onClick={() => setLocation(`/chat/group_${group.id}`)}
                    className={`flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors ${params.id === `group_${group.id}` ? 'bg-muted' : ''}`}
                  >
                    <Avatar className="h-12 w-12 border border-border rounded-xl">
                      <AvatarImage src={group.avatarUrl || undefined} />
                      <AvatarFallback className="rounded-xl"><Hash className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{group.name}</span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                          {group.lastMessage ? new Date(group.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {group.lastMessage?.content || "No messages yet"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Main Area */}
      <div className={`flex-1 flex-col bg-background/50 h-full relative ${!isChatSelected ? 'hidden md:flex' : 'flex'}`}>
        <Switch>
          <Route path="/chat/:id">
            {(params) => <ChatArea chatId={params.id} />}
          </Route>
          <Route>
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <p className="font-medium text-foreground">Select a conversation</p>
              <p className="text-sm">Choose someone from the sidebar to start chatting</p>
            </div>
          </Route>
        </Switch>
      </div>
    </div>
  );
}
