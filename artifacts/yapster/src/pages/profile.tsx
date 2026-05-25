import { useLocation, useParams } from "wouter";
import { useGetMe, useGetUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, UserCircle } from "lucide-react";

export default function Profile() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const userId = parseInt(params.userId || "0", 10);
  
  const { data: me } = useGetMe();
  const { data: user, isLoading } = useGetUser(userId, { query: { enabled: !!userId && userId !== me?.id } });
  
  const displayUser = userId === me?.id ? me : user;
  const isOwnProfile = userId === me?.id;

  return (
    <div className="min-h-[100dvh] bg-background md:bg-muted/30 flex flex-col md:py-8">
      <div className="w-full max-w-2xl mx-auto bg-card min-h-screen md:min-h-0 md:rounded-2xl md:border shadow-sm flex flex-col">
        <div className="h-14 border-b flex items-center px-4 gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="-ml-2" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Profile</h1>
        </div>
        
        <div className="p-6 flex-1 flex flex-col items-center">
          {isLoading ? (
            <div className="animate-pulse flex flex-col items-center w-full">
              <div className="h-32 w-32 rounded-full bg-muted mb-4" />
              <div className="h-8 bg-muted rounded w-48 mb-2" />
              <div className="h-4 bg-muted rounded w-32 mb-8" />
            </div>
          ) : (
            <>
              <div className="relative mb-6">
                <Avatar className="h-32 w-32 border-4 border-background shadow-md">
                  <AvatarImage src={displayUser?.avatarUrl || undefined} />
                  <AvatarFallback className="text-4xl">{displayUser?.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              
              <h2 className="text-2xl font-bold">{displayUser?.displayName}</h2>
              <p className="text-muted-foreground mt-1">@{displayUser?.username}</p>
              
              {displayUser?.bio && (
                <div className="mt-6 p-4 bg-muted/50 rounded-xl w-full text-center">
                  <p>{displayUser.bio}</p>
                </div>
              )}
              
              {isOwnProfile && (
                <div className="w-full mt-8 space-y-3">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/settings")}>
                    <UserCircle className="h-5 w-5 mr-3" />
                    Edit Profile
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
