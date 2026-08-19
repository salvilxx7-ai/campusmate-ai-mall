import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";
import CustomerService from "@/pages/CustomerService";
import Evaluation from "@/pages/Evaluation";
import SystemStatus from "@/pages/SystemStatus";
import ProjectGuide from "@/pages/ProjectGuide";
import Profile from "@/pages/Profile";
import ListingManager from "@/pages/ListingManager";
import PublishItem from "@/pages/PublishItem";
import Goods from "@/pages/Goods";
import Home from "./pages/Home";
import Login from "./pages/Login";
import OrderDetail from "@/pages/OrderDetail";
import Orders from "@/pages/Orders";
import ProductDetail from "@/pages/ProductDetail";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/goods" component={Goods} />
    <Route path="/goods/:id" component={ProductDetail} />
    <Route path="/orders" component={Orders} />
    <Route path="/orders/:id" component={OrderDetail} />
    <Route path="/admin" component={Admin} />
    <Route path="/admin/system" component={SystemStatus} />
    <Route path="/assistant" component={CustomerService} />
    <Route path="/evaluation" component={Evaluation} />
    <Route path="/project" component={ProjectGuide} />
    <Route path="/profile" component={Profile} />
    <Route path="/profile/listings" component={ListingManager} />
    <Route path="/publish" component={PublishItem} />
    <Route path="/login" component={Login} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-center" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
