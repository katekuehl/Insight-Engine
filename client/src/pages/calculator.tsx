import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Calculator as CalculatorIcon, RefreshCw, TrendingUp, AlertCircle, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Calculator() {
  const { organization } = useAuth();
  
  const [budgetIncrease, setBudgetIncrease] = useState(0);
  const [contentIncrease, setContentIncrease] = useState(0);
  const [audienceGrowth, setAudienceGrowth] = useState(0);

  const baselineUsers = 1250;
  const baselineGrowthRate = 0.05;

  const calculatePrediction = useMemo(() => {
    const budgetMultiplier = 1 + (budgetIncrease / 100) * 0.3;
    const contentMultiplier = 1 + (contentIncrease / 100) * 0.2;
    const audienceMultiplier = 1 + (audienceGrowth / 100);
    
    const adjustedGrowthRate = baselineGrowthRate * budgetMultiplier * contentMultiplier * audienceMultiplier;
    
    const predictions = [];
    for (let month = 0; month <= 3; month++) {
      const users = Math.round(baselineUsers * Math.pow(1 + adjustedGrowthRate, month));
      predictions.push({
        month,
        label: month === 0 ? "Now" : `${month * 30} days`,
        users,
        baseline: Math.round(baselineUsers * Math.pow(1 + baselineGrowthRate, month)),
      });
    }
    
    return predictions;
  }, [budgetIncrease, contentIncrease, audienceGrowth]);

  const confidenceMargin = useMemo(() => {
    const totalChange = Math.abs(budgetIncrease) + Math.abs(contentIncrease) + Math.abs(audienceGrowth);
    if (totalChange === 0) return 5;
    if (totalChange <= 50) return 10;
    if (totalChange <= 100) return 15;
    return 25;
  }, [budgetIncrease, contentIncrease, audienceGrowth]);

  const handleReset = () => {
    setBudgetIncrease(0);
    setContentIncrease(0);
    setAudienceGrowth(0);
  };

  const chartData = calculatePrediction.map((p) => ({
    ...p,
    upper: Math.round(p.users * (1 + confidenceMargin / 100)),
    lower: Math.round(p.users * (1 - confidenceMargin / 100)),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-calculator-title">
            Predictive Calculator
          </h1>
          <p className="text-muted-foreground mt-1">
            Project your future user growth based on different scenarios
          </p>
        </div>
        <Button variant="outline" onClick={handleReset} data-testid="button-reset">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalculatorIcon className="h-5 w-5" />
              Input Parameters
            </CardTitle>
            <CardDescription>
              Adjust the sliders to see how changes affect your projections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Increase Budget By</Label>
                  <UITooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Marketing and advertising budget increase</p>
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={budgetIncrease}
                    onChange={(e) => setBudgetIncrease(Number(e.target.value))}
                    className="w-20 text-right"
                    min={-100}
                    max={200}
                    data-testid="input-budget"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[budgetIncrease]}
                onValueChange={([value]) => setBudgetIncrease(value)}
                min={-50}
                max={200}
                step={5}
                data-testid="slider-budget"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Increase Content By</Label>
                  <UITooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Content production and publishing frequency</p>
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={contentIncrease}
                    onChange={(e) => setContentIncrease(Number(e.target.value))}
                    className="w-20 text-right"
                    min={-100}
                    max={200}
                    data-testid="input-content"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[contentIncrease]}
                onValueChange={([value]) => setContentIncrease(value)}
                min={-50}
                max={200}
                step={5}
                data-testid="slider-content"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Audience Growth</Label>
                  <UITooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Expected organic audience growth rate</p>
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={audienceGrowth}
                    onChange={(e) => setAudienceGrowth(Number(e.target.value))}
                    className="w-20 text-right"
                    min={-100}
                    max={200}
                    data-testid="input-audience"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[audienceGrowth]}
                onValueChange={([value]) => setAudienceGrowth(value)}
                min={-50}
                max={200}
                step={5}
                data-testid="slider-audience"
              />
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <h4 className="font-medium text-sm">Formula Used</h4>
              <p className="text-xs text-muted-foreground font-mono">
                predicted_users = current_users × (1 + growth_rate)^months
              </p>
              <p className="text-xs text-muted-foreground">
                Where growth_rate is adjusted by budget (30% impact), content (20% impact), 
                and audience growth multipliers.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Projected Results
            </CardTitle>
            <CardDescription>
              Estimated user growth over the next 90 days
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {calculatePrediction.slice(1).map((pred, index) => (
                <Card key={index} className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{pred.label}</p>
                    <p className="text-2xl font-bold font-mono" data-testid={`prediction-${pred.month * 30}`}>
                      {pred.users.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      users expected
                    </p>
                    {pred.users > pred.baseline && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        +{((pred.users / pred.baseline - 1) * 100).toFixed(0)}% vs baseline
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="h-64" data-testid="chart-predictions">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name === "users" ? "Predicted" : name === "baseline" ? "Baseline" : name
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="baseline" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Baseline"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    stroke="hsl(217, 91%, 48%)" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Predicted"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Confidence Interval</span>
              </div>
              <Badge variant="outline" data-testid="badge-confidence">
                ±{confidenceMargin}%
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground text-center" data-testid="text-data-info">
              Based on baseline of {baselineUsers.toLocaleString()} current users with {(baselineGrowthRate * 100).toFixed(0)}% monthly growth.
              <br />
              Using simulated data for demonstration purposes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
